/**
 * Edge Function: compute-health-scores
 * Computes organization health scores and upserts into org_health_scores table.
 *
 * POST /compute-health-scores (or invoked via pg_cron / Supabase cron)
 *   returns: { success: true, computed: number }
 *
 * Health Score Algorithm (0-100):
 *   - Login frequency (last 30d)          — 25% weight
 *   - Device activity rate                 — 25% weight
 *   - Feature adoption (alerts, reports)   — 20% weight
 *   - Support ticket volume (inverse)      — 15% weight
 *   - Payment health (no failures)         — 15% weight
 *
 * Security: Service-role only (cron invocation) or super_admin
 *
 * #56: Customer overview page with org health scores
 */

import {
  createEdgeFunction,
  createSuccessResponse,
  createErrorResponse,
} from '../_shared/request-handler.ts'
import { createServiceClient, getUserContext } from '../_shared/auth.ts'

/**
 * Compute a single sub-score (0-100) for login frequency.
 * Active logins in last 30 days relative to member count.
 */
function computeLoginScore(loginCount: number, memberCount: number): number {
  if (memberCount === 0) return 0
  // Expect at least 10 logins per member per 30 days (every 3 days)
  const ratio = loginCount / (memberCount * 10)
  return Math.min(100, Math.round(ratio * 100))
}

/**
 * Device activity: percentage of devices seen in last 24h.
 */
function computeDeviceActivityScore(activeDevices: number, totalDevices: number): number {
  if (totalDevices === 0) return 50 // No devices = neutral (onboarding)
  return Math.round((activeDevices / totalDevices) * 100)
}

/**
 * Feature adoption: has alerts configured + has reports.
 */
function computeFeatureAdoptionScore(alertRuleCount: number, reportCount: number): number {
  let score = 0
  // Alert rules: 0 = 0%, 1-2 = 40%, 3+ = 60%
  if (alertRuleCount >= 3) score += 60
  else if (alertRuleCount >= 1) score += 40
  // Reports: any = +40%
  if (reportCount > 0) score += 40
  return Math.min(100, score)
}

/**
 * Support tickets (inverse): fewer tickets = healthier.
 * 0 tickets = 100, 1-2 = 80, 3-5 = 60, 6-10 = 30, 10+ = 0
 */
function computeSupportScore(ticketCount: number): number {
  if (ticketCount === 0) return 100
  if (ticketCount <= 2) return 80
  if (ticketCount <= 5) return 60
  if (ticketCount <= 10) return 30
  return 0
}

/**
 * Payment health: ratio of successful payments (no failures in last 90 days).
 */
function computePaymentHealthScore(paidInvoices: number, totalInvoices: number, failedPayments: number): number {
  if (totalInvoices === 0) return 100 // No invoices = free tier, healthy
  const failurePenalty = failedPayments > 0 ? Math.min(50, failedPayments * 20) : 0
  const paidRatio = paidInvoices / totalInvoices
  return Math.max(0, Math.round(paidRatio * 100) - failurePenalty)
}

/**
 * Weighted composite score.
 */
function computeCompositeScore(
  login: number,
  device: number,
  feature: number,
  support: number,
  payment: number
): number {
  return Math.round(
    login * 0.25 +
    device * 0.25 +
    feature * 0.20 +
    support * 0.15 +
    payment * 0.15
  )
}

export default createEdgeFunction(
  async ({ req, userContext }) => {
    if (req.method !== 'POST') {
      return createErrorResponse('POST only', 405)
    }

    // Allow super_admin or service role (cron)
    if (userContext && !userContext.isSuperAdmin) {
      return createErrorResponse('Super admin only', 403)
    }

    const serviceClient = createServiceClient()

    // Fetch all organizations
    const { data: orgs, error: orgError } = await serviceClient
      .from('organizations')
      .select('id')

    if (orgError || !orgs) {
      return createErrorResponse(`Failed to fetch organizations: ${orgError?.message}`, 500)
    }

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    let computed = 0

    for (const org of orgs) {
      try {
        // 1. Login frequency: count user_audit_log logins in last 30d
        const { count: loginCount } = await serviceClient
          .from('user_audit_log')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id)
          .eq('action', 'login')
          .gte('created_at', thirtyDaysAgo)

        // Member count
        const { count: memberCount } = await serviceClient
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id)

        // 2. Device activity: total devices vs devices seen in 24h
        const { count: totalDevices } = await serviceClient
          .from('devices')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id)

        const { count: activeDevices } = await serviceClient
          .from('devices')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id)
          .gte('last_seen', twentyFourHoursAgo)

        // 3. Feature adoption: alert rules + reports
        const { count: alertRuleCount } = await serviceClient
          .from('alert_rules')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id)
          .eq('is_active', true)

        // Reports count (check if table exists, fallback to 0)
        let reportCount = 0
        try {
          const { count } = await serviceClient
            .from('audit_logs')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('resource_type', 'report')
          reportCount = count || 0
        } catch {
          reportCount = 0
        }

        // 4. Support tickets (last 90 days) — use alerts as proxy
        const { count: ticketCount } = await serviceClient
          .from('alerts')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id)
          .eq('severity', 'critical')
          .gte('created_at', ninetyDaysAgo)

        // 5. Payment health: paid vs total invoices + failed payments
        const { count: paidInvoices } = await serviceClient
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id)
          .eq('status', 'paid')
          .gte('created_at', ninetyDaysAgo)

        const { count: totalInvoices } = await serviceClient
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id)
          .gte('created_at', ninetyDaysAgo)

        const { count: failedPayments } = await serviceClient
          .from('payment_history')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id)
          .eq('status', 'failed')
          .gte('created_at', ninetyDaysAgo)

        // Compute sub-scores
        const loginScore = computeLoginScore(loginCount || 0, memberCount || 0)
        const deviceScore = computeDeviceActivityScore(activeDevices || 0, totalDevices || 0)
        const featureScore = computeFeatureAdoptionScore(alertRuleCount || 0, reportCount)
        const supportScore = computeSupportScore(ticketCount || 0)
        const paymentScore = computePaymentHealthScore(paidInvoices || 0, totalInvoices || 0, failedPayments || 0)
        const composite = computeCompositeScore(loginScore, deviceScore, featureScore, supportScore, paymentScore)

        // Upsert health score
        const { error: upsertError } = await serviceClient
          .from('org_health_scores')
          .upsert(
            {
              organization_id: org.id,
              score: composite,
              login_frequency_score: loginScore,
              device_activity_score: deviceScore,
              feature_adoption_score: featureScore,
              support_ticket_score: supportScore,
              payment_health_score: paymentScore,
              computed_at: now.toISOString(),
            },
            { onConflict: 'organization_id' }
          )

        if (upsertError) {
          console.error(`Failed to upsert health score for org ${org.id}:`, upsertError)
        } else {
          computed++
        }
      } catch (err) {
        console.error(`Error computing health for org ${org.id}:`, err)
      }
    }

    return createSuccessResponse({ success: true, computed, total: orgs.length })
  },
  {
    requireAuth: false, // Allow cron (service role) invocations
    allowedMethods: ['POST'],
  }
)
