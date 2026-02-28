/**
 * Quota Check Utility for Edge Functions
 * Shared helper to check organization quotas before allowing resource creation
 */

import { createServiceClient } from './auth.ts'

export interface QuotaCheckResult {
  current_usage: number
  plan_limit: number
  usage_percent: number
  is_warning: boolean
  is_exceeded: boolean
  is_unlimited: boolean
  plan_name: string
}

export type MetricType =
  | 'device_count'
  | 'user_count'
  | 'api_calls'
  | 'storage_bytes'
  | 'edge_function_invocations'

/**
 * Check if an organization has exceeded its quota for a given metric.
 * Uses the check_org_quota SQL function which checks cached values
 * and falls back to live counts.
 *
 * @returns QuotaCheckResult with usage status
 * @throws Error if the quota check fails
 */
export async function checkOrgQuota(
  organizationId: string,
  metricType: MetricType
): Promise<QuotaCheckResult> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('check_org_quota', {
    p_organization_id: organizationId,
    p_metric_type: metricType,
  })

  if (error) {
    console.error(`Quota check failed for org ${organizationId}:`, error)
    throw new Error(`Quota check failed: ${error.message}`)
  }

  if (!data || data.length === 0) {
    // No quota data — allow by default (fail-open)
    return {
      current_usage: 0,
      plan_limit: -1,
      usage_percent: 0,
      is_warning: false,
      is_exceeded: false,
      is_unlimited: true,
      plan_name: 'Unknown',
    }
  }

  return data[0] as QuotaCheckResult
}

/**
 * Enforce quota — throws if the organization has exceeded its limit.
 * Call this before creating a new device, user, etc.
 *
 * @throws Error with a 403-appropriate message if quota exceeded
 */
export async function enforceQuota(
  organizationId: string,
  metricType: MetricType,
  resourceName = 'resource'
): Promise<QuotaCheckResult> {
  const result = await checkOrgQuota(organizationId, metricType)

  if (result.is_exceeded && !result.is_unlimited) {
    throw new QuotaExceededError(
      `${resourceName} limit reached. Your ${result.plan_name} plan allows ${result.plan_limit} ${resourceName}s. ` +
        `Current usage: ${result.current_usage}. Upgrade your plan to add more.`,
      result
    )
  }

  if (result.is_warning && !result.is_unlimited) {
    console.warn(
      `⚠️ Org ${organizationId} at ${result.usage_percent}% of ${metricType} quota ` +
        `(${result.current_usage}/${result.plan_limit})`
    )
  }

  return result
}

/**
 * Error thrown when an organization exceeds its plan quota
 */
export class QuotaExceededError extends Error {
  public readonly quota: QuotaCheckResult
  public readonly statusCode = 403

  constructor(message: string, quota: QuotaCheckResult) {
    super(message)
    this.name = 'QuotaExceededError'
    this.quota = quota
  }
}

/**
 * Refresh usage counts for all organizations.
 * Calls the refresh_usage_counts() SQL function.
 */
export async function refreshUsageCounts(): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase.rpc('refresh_usage_counts')

  if (error) {
    console.error('Failed to refresh usage counts:', error)
    throw new Error(`Usage count refresh failed: ${error.message}`)
  }
}
