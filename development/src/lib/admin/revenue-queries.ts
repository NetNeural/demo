/**
 * Revenue & MRR query helpers for Supabase (super admin)
 * Used by the /dashboard/admin/revenue page (#58)
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────────

/** KPI summary for the revenue dashboard */
export interface RevenueSummary {
  totalMrr: number
  totalArr: number
  netRevenueChange: number       // MRR delta vs previous month
  netRevenueChangePct: number    // % change
  churnRate: number              // % orgs churned this month
  churnedCount: number
  activeCount: number
  trialToPaidRate: number        // % trials that converted
  totalCustomers: number
}

/** Monthly MRR data point */
export interface MrrDataPoint {
  month: string          // ISO month string e.g. "2026-02"
  label: string          // display label e.g. "Feb 2026"
  mrr: number
  activeSubscriptions: number
}

/** Revenue by plan tier */
export interface PlanRevenue {
  planName: string
  planSlug: string
  mrr: number
  customerCount: number
  color: string
}

/** Waterfall data point (new vs churned MRR) */
export interface WaterfallDataPoint {
  month: string
  label: string
  newMrr: number
  churnedMrr: number
  netMrr: number
}

/** Customer count by plan */
export interface PlanCustomerCount {
  planName: string
  planSlug: string
  count: number
  color: string
}

// ── Color palette for plan tiers ───────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  starter: '#3b82f6',
  professional: '#8b5cf6',
  enterprise: '#f59e0b',
  free: '#94a3b8',
}

function getPlanColor(slug: string): string {
  return PLAN_COLORS[slug] || '#6b7280'
}

// ── Queries ────────────────────────────────────────────────────────────

/**
 * Fetch the revenue KPI summary.
 */
export async function fetchRevenueSummary(
  supabase: SupabaseClient
): Promise<RevenueSummary> {
  // 1. Current MRR from active subscriptions
  const { data: activeData } = await supabase
    .from('subscriptions')
    .select('id, billing_plan:billing_plans!inner(price_monthly, price_per_device, pricing_model)')
    .eq('status', 'active')

  let totalMrr = 0
  const activeCount = activeData?.length ?? 0
  if (activeData) {
    for (const sub of activeData) {
      const plan = sub.billing_plan as any
      if (plan) {
        totalMrr += plan.price_monthly ?? 0
      }
    }
  }

  // 2. Previous month MRR (subscriptions that were active last month)
  const lastMonthStart = new Date()
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)
  lastMonthStart.setDate(1)
  lastMonthStart.setHours(0, 0, 0, 0)
  const lastMonthEnd = new Date()
  lastMonthEnd.setDate(1)
  lastMonthEnd.setHours(0, 0, 0, 0)

  const { data: prevData } = await supabase
    .from('subscriptions')
    .select('id, billing_plan:billing_plans!inner(price_monthly)')
    .in('status', ['active', 'canceled'])
    .lte('created_at', lastMonthEnd.toISOString())

  let prevMrr = 0
  if (prevData) {
    for (const sub of prevData) {
      const plan = sub.billing_plan as any
      if (plan) prevMrr += plan.price_monthly ?? 0
    }
  }

  const netRevenueChange = totalMrr - prevMrr
  const netRevenueChangePct = prevMrr > 0 ? (netRevenueChange / prevMrr) * 100 : 0

  // 3. Churn rate from lifecycle stages
  const { count: churnedCount } = await supabase
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .eq('lifecycle_stage', 'churned')

  const { count: totalCustomers } = await supabase
    .from('organizations')
    .select('id', { count: 'exact', head: true })

  const churnRate =
    totalCustomers && totalCustomers > 0
      ? ((churnedCount ?? 0) / totalCustomers) * 100
      : 0

  // 4. Trial-to-paid conversion
  const { count: trialCount } = await supabase
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .eq('lifecycle_stage', 'trial')

  const { count: wasTrialNowPaid } = await supabase
    .from('customer_lifecycle_events')
    .select('id', { count: 'exact', head: true })
    .eq('from_stage', 'trial')
    .eq('to_stage', 'active')

  const totalTrialEver = (trialCount ?? 0) + (wasTrialNowPaid ?? 0)
  const trialToPaidRate =
    totalTrialEver > 0 ? ((wasTrialNowPaid ?? 0) / totalTrialEver) * 100 : 0

  return {
    totalMrr,
    totalArr: totalMrr * 12,
    netRevenueChange,
    netRevenueChangePct,
    churnRate,
    churnedCount: churnedCount ?? 0,
    activeCount,
    trialToPaidRate,
    totalCustomers: totalCustomers ?? 0,
  }
}

/**
 * Fetch MRR trend data for the last N months.
 */
export async function fetchMrrTrend(
  supabase: SupabaseClient,
  months: number = 12
): Promise<MrrDataPoint[]> {
  const monthLabels = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]

  // Build list of month boundaries
  const now = new Date()
  const points: MrrDataPoint[] = []

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const monthStr = d.toISOString().slice(0, 7) // "2026-02"
    const label = `${monthLabels[d.getMonth()]} ${d.getFullYear()}`

    // Subscriptions active in that month
    const { data } = await supabase
      .from('subscriptions')
      .select('id, billing_plan:billing_plans!inner(price_monthly)')
      .in('status', ['active', 'past_due', 'trialing'])
      .lte('created_at', monthEnd.toISOString())

    let mrr = 0
    const count = data?.length ?? 0
    if (data) {
      for (const sub of data) {
        const plan = sub.billing_plan as any
        mrr += plan?.price_monthly ?? 0
      }
    }

    points.push({ month: monthStr, label, mrr, activeSubscriptions: count })
  }

  return points
}

/**
 * Fetch revenue breakdown by plan tier.
 */
export async function fetchRevenueByPlan(
  supabase: SupabaseClient
): Promise<PlanRevenue[]> {
  const { data } = await supabase
    .from('subscriptions')
    .select('id, billing_plan:billing_plans!inner(name, slug, price_monthly)')
    .eq('status', 'active')

  if (!data?.length) return []

  const planMap = new Map<string, { name: string; slug: string; mrr: number; count: number }>()
  for (const sub of data) {
    const plan = sub.billing_plan as any
    if (!plan) continue
    const slug = plan.slug as string
    const existing = planMap.get(slug)
    if (existing) {
      existing.mrr += plan.price_monthly ?? 0
      existing.count++
    } else {
      planMap.set(slug, {
        name: plan.name,
        slug,
        mrr: plan.price_monthly ?? 0,
        count: 1,
      })
    }
  }

  return Array.from(planMap.values()).map((p) => ({
    planName: p.name,
    planSlug: p.slug,
    mrr: p.mrr,
    customerCount: p.count,
    color: getPlanColor(p.slug),
  }))
}

/**
 * Fetch customer count by plan tier (including orgs with no subscription).
 */
export async function fetchCustomersByPlan(
  supabase: SupabaseClient
): Promise<PlanCustomerCount[]> {
  // Active subscriptions grouped by plan
  const { data } = await supabase
    .from('subscriptions')
    .select('id, billing_plan:billing_plans!inner(name, slug)')
    .eq('status', 'active')

  const planMap = new Map<string, { name: string; slug: string; count: number }>()
  if (data) {
    for (const sub of data) {
      const plan = sub.billing_plan as any
      if (!plan) continue
      const slug = plan.slug as string
      const existing = planMap.get(slug)
      if (existing) {
        existing.count++
      } else {
        planMap.set(slug, { name: plan.name, slug, count: 1 })
      }
    }
  }

  // Count orgs without any subscription → "No Plan"
  const { count: totalOrgs } = await supabase
    .from('organizations')
    .select('id', { count: 'exact', head: true })

  const subscribedCount = data?.length ?? 0
  const noPlanCount = (totalOrgs ?? 0) - subscribedCount

  const result: PlanCustomerCount[] = Array.from(planMap.values()).map((p) => ({
    planName: p.name,
    planSlug: p.slug,
    count: p.count,
    color: getPlanColor(p.slug),
  }))

  if (noPlanCount > 0) {
    result.push({
      planName: 'No Plan',
      planSlug: 'none',
      count: noPlanCount,
      color: '#94a3b8',
    })
  }

  return result
}

/**
 * Fetch new vs churned MRR data (waterfall chart) for the last N months.
 * "New MRR" = subscriptions created in that month.
 * "Churned MRR" = lifecycle events transitioning to 'churned' in that month.
 */
export async function fetchMrrWaterfall(
  supabase: SupabaseClient,
  months: number = 6
): Promise<WaterfallDataPoint[]> {
  const monthLabels = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  const now = new Date()
  const points: WaterfallDataPoint[] = []

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const label = `${monthLabels[monthStart.getMonth()]} ${monthStart.getFullYear()}`
    const month = monthStart.toISOString().slice(0, 7)

    // New subscriptions created in this month
    const { data: newSubs } = await supabase
      .from('subscriptions')
      .select('id, billing_plan:billing_plans!inner(price_monthly)')
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString())

    let newMrr = 0
    if (newSubs) {
      for (const sub of newSubs) {
        const plan = sub.billing_plan as any
        newMrr += plan?.price_monthly ?? 0
      }
    }

    // Churned events in this month (lifecycle_events → 'churned')
    const { data: churnEvents } = await supabase
      .from('customer_lifecycle_events')
      .select('organization_id')
      .eq('to_stage', 'churned')
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString())

    // Get MRR that was lost for each churned org
    let churnedMrr = 0
    if (churnEvents?.length) {
      const orgIds = [...new Set(churnEvents.map((e) => e.organization_id))]
      const { data: churnedSubs } = await supabase
        .from('subscriptions')
        .select('organization_id, billing_plan:billing_plans!inner(price_monthly)')
        .in('organization_id', orgIds)

      if (churnedSubs) {
        for (const sub of churnedSubs) {
          const plan = sub.billing_plan as any
          churnedMrr += plan?.price_monthly ?? 0
        }
      }
    }

    points.push({ month, label, newMrr, churnedMrr, netMrr: newMrr - churnedMrr })
  }

  return points
}

/**
 * Generate CSV string from the revenue summary + trend data.
 */
export function revenueDataToCsv(
  summary: RevenueSummary,
  trend: MrrDataPoint[],
  planRevenue: PlanRevenue[]
): string {
  const lines: string[] = []

  // KPI Section
  lines.push('=== Revenue KPIs ===')
  lines.push('Metric,Value')
  lines.push(`Total MRR,$${summary.totalMrr.toFixed(2)}`)
  lines.push(`Total ARR,$${summary.totalArr.toFixed(2)}`)
  lines.push(`Net Revenue Change,$${summary.netRevenueChange.toFixed(2)}`)
  lines.push(`Net Revenue Change %,${summary.netRevenueChangePct.toFixed(1)}%`)
  lines.push(`Churn Rate,${summary.churnRate.toFixed(1)}%`)
  lines.push(`Trial-to-Paid Rate,${summary.trialToPaidRate.toFixed(1)}%`)
  lines.push(`Total Customers,${summary.totalCustomers}`)
  lines.push(`Active Subscriptions,${summary.activeCount}`)
  lines.push('')

  // MRR Trend
  lines.push('=== MRR Trend ===')
  lines.push('Month,MRR,Active Subscriptions')
  for (const p of trend) {
    lines.push(`${p.label},$${p.mrr.toFixed(2)},${p.activeSubscriptions}`)
  }
  lines.push('')

  // Revenue by Plan
  lines.push('=== Revenue by Plan ===')
  lines.push('Plan,MRR,Customer Count')
  for (const p of planRevenue) {
    lines.push(`${p.planName},$${p.mrr.toFixed(2)},${p.customerCount}`)
  }

  return lines.join('\n')
}
