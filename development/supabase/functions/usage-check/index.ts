/**
 * Edge Function: usage-check
 * Returns current usage vs plan limits for an organization.
 *
 * GET /usage-check — returns all metric quotas for the user's org
 * POST /usage-check/refresh — triggers a usage count refresh (admin only)
 *
 * #244: Usage Metering System
 */

import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import {
  createServiceClient,
  getUserContext,
} from '../_shared/auth.ts'
import {
  checkOrgQuota,
  refreshUsageCounts,
  type MetricType,
} from '../_shared/quota-check.ts'

const ALL_METRICS: MetricType[] = [
  'device_count',
  'user_count',
  'api_calls',
  'storage_bytes',
  'edge_function_invocations',
]

export default createEdgeFunction(
  async ({ req }) => {
    const userContext = await getUserContext(req)
    const url = new URL(req.url)

    if (!userContext.organizationId) {
      throw new DatabaseError('User has no organization', 400)
    }

    // POST /usage-check/refresh — admin-only usage refresh
    if (req.method === 'POST' && url.pathname.endsWith('/refresh')) {
      if (!['super_admin', 'org_owner', 'org_admin'].includes(userContext.role)) {
        throw new DatabaseError('Only admins can trigger usage refresh', 403)
      }

      await refreshUsageCounts()

      return createSuccessResponse({
        message: 'Usage counts refreshed successfully',
        refreshed_at: new Date().toISOString(),
      })
    }

    // GET /usage-check — return all quotas for the org
    if (req.method === 'GET') {
      const quotas: Record<string, unknown> = {}
      let hasWarning = false
      let hasExceeded = false

      for (const metric of ALL_METRICS) {
        const result = await checkOrgQuota(userContext.organizationId, metric)
        quotas[metric] = result
        if (result.is_warning) hasWarning = true
        if (result.is_exceeded) hasExceeded = true
      }

      // Also get subscription info
      const supabase = createServiceClient()
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*, billing_plans:plan_id(*)')
        .eq('organization_id', userContext.organizationId)
        .in('status', ['active', 'trialing', 'past_due'])
        .maybeSingle()

      return createSuccessResponse({
        organization_id: userContext.organizationId,
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              plan: subscription.billing_plans,
              current_period_end: subscription.current_period_end,
              cancel_at_period_end: subscription.cancel_at_period_end,
            }
          : null,
        quotas,
        summary: {
          has_warning: hasWarning,
          has_exceeded: hasExceeded,
        },
        checked_at: new Date().toISOString(),
      })
    }

    throw new DatabaseError('Method not allowed', 405)
  },
  {
    requireAuth: true,
    allowedMethods: ['GET', 'POST'],
  }
)
