/**
 * Customer overview query helpers for Supabase (super admin)
 * Used by the /dashboard/admin/customers page (#56)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CustomerOverviewRow, CustomerSummaryStats, HealthStatus, LifecycleStage } from '@/types/billing'
import { getHealthStatus, getLifecycleStage } from '@/types/billing'

/** Columns selected from admin_customer_overview view */
const CUSTOMER_SELECT = `
  id,
  name,
  slug,
  subscription_tier,
  is_active,
  created_at,
  last_updated,
  device_count,
  member_count,
  active_device_count,
  subscription_id,
  subscription_status,
  current_period_end,
  cancel_at_period_end,
  plan_name,
  plan_slug,
  mrr,
  health_score,
  login_frequency_score,
  device_activity_score,
  feature_adoption_score,
  support_ticket_score,
  payment_health_score,
  health_computed_at,
  last_active
` as const

/** Filter options for the customer table */
export interface CustomerFilters {
  search?: string
  planSlug?: string
  healthStatus?: HealthStatus
  lifecycleStage?: LifecycleStage
  sortBy?: string
  sortDesc?: boolean
}

/** Paginated query result */
export interface CustomerQueryResult {
  data: CustomerOverviewRow[]
  count: number
  error: string | null
}

/**
 * Fetch paginated customer overview data.
 * Must use service_role or super admin JWT.
 */
export async function fetchCustomers(
  supabase: SupabaseClient,
  page: number = 0,
  pageSize: number = 25,
  filters: CustomerFilters = {}
): Promise<CustomerQueryResult> {
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('admin_customer_overview')
    .select(CUSTOMER_SELECT, { count: 'exact' })

  // Search filter
  if (filters.search) {
    const term = `%${filters.search}%`
    query = query.or(`name.ilike.${term},slug.ilike.${term}`)
  }

  // Plan filter
  if (filters.planSlug) {
    query = query.eq('plan_slug', filters.planSlug)
  }

  // Health status filter (score ranges)
  if (filters.healthStatus === 'healthy') {
    query = query.gte('health_score', 80)
  } else if (filters.healthStatus === 'at_risk') {
    query = query.gte('health_score', 50).lt('health_score', 80)
  } else if (filters.healthStatus === 'critical') {
    query = query.lt('health_score', 50)
  }

  // Lifecycle filter — applied client-side after fetch (depends on multiple fields)
  // Sort
  const sortCol = filters.sortBy || 'name'
  const sortAsc = filters.sortDesc === undefined ? true : !filters.sortDesc
  query = query.order(sortCol, { ascending: sortAsc })

  // Pagination
  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) {
    return { data: [], count: 0, error: error.message }
  }

  let rows = (data || []) as CustomerOverviewRow[]

  // Client-side lifecycle filter
  if (filters.lifecycleStage) {
    rows = rows.filter(r => getLifecycleStage(r) === filters.lifecycleStage)
  }

  return { data: rows, count: count || 0, error: null }
}

/**
 * Compute summary stats from all customers (no pagination).
 */
export async function fetchCustomerSummary(
  supabase: SupabaseClient
): Promise<CustomerSummaryStats> {
  const { data, error } = await supabase
    .from('admin_customer_overview')
    .select('id, is_active, mrr, health_score, subscription_status, cancel_at_period_end')

  if (error || !data) {
    return {
      totalCustomers: 0,
      activeCustomers: 0,
      totalMrr: 0,
      avgHealth: 0,
      churnRate: 0,
      atRiskCount: 0,
    }
  }

  const rows = data as CustomerOverviewRow[]
  const total = rows.length
  const active = rows.filter(r => r.is_active).length
  const totalMrr = rows.reduce((sum, r) => sum + (Number(r.mrr) || 0), 0)
  const avgHealth = total > 0 ? Math.round(rows.reduce((sum, r) => sum + (r.health_score || 0), 0) / total) : 0
  const churned = rows.filter(r => r.subscription_status === 'canceled').length
  const churnRate = total > 0 ? Math.round((churned / total) * 100) : 0
  const atRisk = rows.filter(r => {
    const status = getHealthStatus(r.health_score || 0)
    return status === 'at_risk' || status === 'critical'
  }).length

  return {
    totalCustomers: total,
    activeCustomers: active,
    totalMrr: totalMrr,
    avgHealth,
    churnRate,
    atRiskCount: atRisk,
  }
}

/**
 * Fetch counts grouped by health status.
 */
export async function fetchHealthStatusCounts(
  supabase: SupabaseClient
): Promise<Record<HealthStatus | 'all', number>> {
  const { data, error } = await supabase
    .from('admin_customer_overview')
    .select('health_score')

  const result: Record<HealthStatus | 'all', number> = {
    all: 0,
    healthy: 0,
    at_risk: 0,
    critical: 0,
  }

  if (error || !data) return result

  result.all = data.length
  for (const row of data) {
    const status = getHealthStatus((row as { health_score: number }).health_score || 0)
    result[status]++
  }

  return result
}

/**
 * Fetch distinct plan slugs for the plan filter dropdown.
 */
export async function fetchPlanOptions(
  supabase: SupabaseClient
): Promise<{ slug: string; name: string }[]> {
  const { data, error } = await supabase
    .from('admin_customer_overview')
    .select('plan_slug, plan_name')

  if (error || !data) return []

  // Deduplicate
  const seen = new Set<string>()
  const plans: { slug: string; name: string }[] = []
  for (const row of data as { plan_slug: string | null; plan_name: string | null }[]) {
    if (row.plan_slug && !seen.has(row.plan_slug)) {
      seen.add(row.plan_slug)
      plans.push({ slug: row.plan_slug, name: row.plan_name || row.plan_slug })
    }
  }
  return plans.sort((a, b) => a.name.localeCompare(b.name))
}
