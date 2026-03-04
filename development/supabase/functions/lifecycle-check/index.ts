/**
 * Edge Function: lifecycle-check
 * Daily cron job that checks all organizations for lifecycle stage transitions.
 *
 * POST /lifecycle-check
 *   returns: { success: true, transitions: number, notified: number }
 *
 * Transition Rules:
 *   trial → active:      first payment succeeds
 *   active → at_risk:    health score < 40 for 14+ consecutive days
 *   at_risk → churned:   subscription cancelled OR 60 days inactive
 *   churned → reactivated: new active subscription created
 *
 * At-risk triggers notification to super admins.
 *
 * #57: Customer lifecycle tracking with stage transitions
 */

import {
  createEdgeFunction,
  createSuccessResponse,
  createErrorResponse,
} from '../_shared/request-handler.ts'
import { createServiceClient } from '../_shared/auth.ts'

interface TransitionResult {
  orgId: string
  orgName: string
  from: string
  to: string
}

export default createEdgeFunction(
  async ({ req }) => {
    if (req.method !== 'POST') {
      return createErrorResponse('POST only', 405)
    }

    const serviceClient = createServiceClient()

    // Fetch all organizations with their current lifecycle data
    const { data: orgs, error: orgError } = await serviceClient
      .from('organizations')
      .select(`
        id,
        name,
        lifecycle_stage,
        lifecycle_stage_changed_at,
        is_active
      `)

    if (orgError || !orgs) {
      return createErrorResponse(`Failed to fetch organizations: ${orgError?.message}`, 500)
    }

    const now = new Date()
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    const transitions: TransitionResult[] = []
    const atRiskOrgs: { name: string; id: string }[] = []

    for (const org of orgs) {
      const currentStage = org.lifecycle_stage || 'trial'
      let newStage: string | null = null
      let reason = ''

      try {
        // --- Rule 1: trial → active (first payment succeeds) ---
        if (currentStage === 'trial') {
          const { count: paidCount } = await serviceClient
            .from('invoices')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('status', 'paid')

          if (paidCount && paidCount > 0) {
            newStage = 'active'
            reason = 'First payment succeeded'
          } else {
            // Check if they have devices → onboarding
            const { count: deviceCount } = await serviceClient
              .from('devices')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', org.id)

            if (deviceCount && deviceCount > 0 && currentStage === 'trial') {
              newStage = 'onboarding'
              reason = 'First device added, entering onboarding'
            }
          }
        }

        // --- Rule 2: active → at_risk (health < 40 for 14+ days) ---
        if (currentStage === 'active') {
          const { data: healthData } = await serviceClient
            .from('org_health_scores')
            .select('score, computed_at')
            .eq('organization_id', org.id)
            .single()

          if (healthData && healthData.score < 40) {
            // Check if health has been low for 14+ days
            const computedAt = new Date(healthData.computed_at)
            const stageChangedAt = org.lifecycle_stage_changed_at
              ? new Date(org.lifecycle_stage_changed_at)
              : new Date(0)

            // If they've been active for 14+ days and health is still low
            if (stageChangedAt < fourteenDaysAgo) {
              newStage = 'at_risk'
              reason = `Health score ${healthData.score} (below 40) for 14+ days`
            }
          }

          // Also check: subscription past_due
          const { data: sub } = await serviceClient
            .from('subscriptions')
            .select('status')
            .eq('organization_id', org.id)
            .in('status', ['past_due'])
            .limit(1)
            .maybeSingle()

          if (sub) {
            newStage = 'at_risk'
            reason = 'Subscription payment past due'
          }
        }

        // --- Rule 3: at_risk → churned (subscription cancelled OR 60 days inactive) ---
        if (currentStage === 'at_risk') {
          // Check subscription cancelled
          const { data: cancelledSub } = await serviceClient
            .from('subscriptions')
            .select('status')
            .eq('organization_id', org.id)
            .eq('status', 'canceled')
            .limit(1)
            .maybeSingle()

          if (cancelledSub) {
            newStage = 'churned'
            reason = 'Subscription cancelled'
          } else {
            // Check 60 days inactive (no login)
            const { data: lastLogin } = await serviceClient
              .from('users')
              .select('last_login')
              .eq('organization_id', org.id)
              .order('last_login', { ascending: false, nullsFirst: false })
              .limit(1)
              .maybeSingle()

            if (!lastLogin?.last_login || new Date(lastLogin.last_login) < sixtyDaysAgo) {
              newStage = 'churned'
              reason = 'No user login for 60+ days'
            }
          }
        }

        // --- Rule 4: churned → reactivated (new active subscription) ---
        if (currentStage === 'churned') {
          const { data: activeSub } = await serviceClient
            .from('subscriptions')
            .select('status')
            .eq('organization_id', org.id)
            .in('status', ['active', 'trialing'])
            .limit(1)
            .maybeSingle()

          if (activeSub) {
            newStage = 'reactivated'
            reason = 'New active subscription created'
          }
        }

        // --- Apply transition ---
        if (newStage && newStage !== currentStage) {
          // Insert lifecycle event
          await serviceClient
            .from('customer_lifecycle_events')
            .insert({
              organization_id: org.id,
              from_stage: currentStage,
              to_stage: newStage,
              trigger_type: 'automatic',
              trigger_reason: reason,
              metadata: {
                computed_at: now.toISOString(),
                cron_run: true,
              },
            })

          // Update organization
          await serviceClient
            .from('organizations')
            .update({
              lifecycle_stage: newStage,
              lifecycle_stage_changed_at: now.toISOString(),
            })
            .eq('id', org.id)

          transitions.push({
            orgId: org.id,
            orgName: org.name,
            from: currentStage,
            to: newStage,
          })

          // Track at-risk notifications
          if (newStage === 'at_risk') {
            atRiskOrgs.push({ name: org.name, id: org.id })
          }
        }
      } catch (err) {
        console.error(`Error checking lifecycle for org ${org.id}:`, err)
      }
    }

    // Notify super admins about at-risk customers
    let notified = 0
    if (atRiskOrgs.length > 0) {
      try {
        // Get super admin user IDs
        const { data: admins } = await serviceClient
          .from('users')
          .select('id, email')
          .eq('role', 'super_admin')
          .eq('is_active', true)

        if (admins && admins.length > 0) {
          // Insert in-app notifications for each super admin
          const notifications = admins.flatMap(admin =>
            atRiskOrgs.map(org => ({
              organization_id: org.id,
              recipient_id: admin.id,
              method: 'in_app' as const,
              status: 'pending' as const,
              metadata: {
                type: 'at_risk_customer',
                message: `${org.name} has entered at-risk stage`,
                org_name: org.name,
              },
            }))
          )

          const { error: notifError } = await serviceClient
            .from('notifications')
            .insert(notifications)

          if (!notifError) {
            notified = notifications.length
          }
        }
      } catch (err) {
        console.error('Error sending at-risk notifications:', err)
      }
    }

    return createSuccessResponse({
      success: true,
      checked: orgs.length,
      transitions: transitions.length,
      transitionDetails: transitions,
      notified,
    })
  },
  {
    requireAuth: false, // Cron invocation via service role
    allowedMethods: ['POST'],
  }
)
