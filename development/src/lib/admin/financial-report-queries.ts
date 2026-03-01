/**
 * Financial report query helpers for Supabase (super admin)
 * Used by the /dashboard/admin/reports/financial page (#59)
 *
 * Reports:
 *   1. Accounts Receivable (AR) Aging
 *   2. Payment Failure Analysis
 *   3. Tax / Revenue Summary by Jurisdiction
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── AR Aging Types ─────────────────────────────────────────────────────

/** One row in the AR aging report (per organization) */
export interface ARAgingRow {
  organizationId: string
  organizationName: string
  current: number
  days1to30: number
  days31to60: number
  days61to90: number
  days90plus: number
  total: number
}

/** Summary totals for AR aging */
export interface ARAgingSummary {
  rows: ARAgingRow[]
  totals: Omit<ARAgingRow, 'organizationId' | 'organizationName'>
}

// ── Payment Failure Types ──────────────────────────────────────────────

/** Payment failures grouped by reason */
export interface FailureByReason {
  reason: string
  count: number
  totalAmount: number
}

/** Monthly failure trend data point */
export interface FailureTrendPoint {
  month: string
  label: string
  failedCount: number
  failedAmount: number
  recoveredCount: number
  recoveredAmount: number
}

/** Organization with most failures */
export interface TopFailureOrg {
  organizationId: string
  organizationName: string
  failedCount: number
  failedAmount: number
}

/** Full payment failure report */
export interface PaymentFailureReport {
  byReason: FailureByReason[]
  trend: FailureTrendPoint[]
  topOrgs: TopFailureOrg[]
  totalFailed: number
  totalRecovered: number
  recoveryRate: number
}

// ── Tax Summary Types ──────────────────────────────────────────────────

/** Revenue by jurisdiction row */
export interface JurisdictionRevenue {
  jurisdiction: string
  state: string
  country: string
  revenue: number
  invoiceCount: number
  customerCount: number
}

/** Quarterly tax summary */
export interface QuarterlyTaxSummary {
  quarter: string      // e.g. "Q1 2026"
  year: number
  quarterNum: number
  totalRevenue: number
  jurisdictions: JurisdictionRevenue[]
}

/** Full tax summary report */
export interface TaxSummaryReport {
  quarterly: QuarterlyTaxSummary[]
  annual: {
    year: number
    totalRevenue: number
    jurisdictions: JurisdictionRevenue[]
  }[]
}

// ── Helpers ────────────────────────────────────────────────────────────

function centsToUsd(cents: number): number {
  return cents / 100
}

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr + '-01')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// ── AR Aging Query ─────────────────────────────────────────────────────

/**
 * Fetch accounts receivable aging report.
 * Buckets: Current, 1-30 days, 31-60 days, 61-90 days, 90+ days overdue.
 * Only includes invoices with status 'open' or 'overdue'.
 */
export async function fetchARAgingReport(
  supabase: SupabaseClient
): Promise<ARAgingSummary> {
  const { data: invoices, error } = await (supabase as any)
    .from('invoices')
    .select(`
      id,
      amount_cents,
      period_end,
      status,
      organization_id,
      organizations:organization_id(name)
    `)
    .in('status', ['open', 'overdue', 'sent'])

  if (error) throw new Error(`AR Aging query failed: ${error.message}`)

  const now = new Date()
  const orgMap = new Map<string, ARAgingRow>()

  for (const inv of invoices ?? []) {
    const orgId = inv.organization_id as string
    const orgName = (inv.organizations as any)?.name ?? orgId
    const amount = centsToUsd(inv.amount_cents ?? 0)
    const dueDate = new Date(inv.period_end ?? inv.created_at)
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86400000))

    if (!orgMap.has(orgId)) {
      orgMap.set(orgId, {
        organizationId: orgId,
        organizationName: orgName,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
        total: 0,
      })
    }

    const row = orgMap.get(orgId)!
    row.total += amount

    if (daysOverdue <= 0) {
      row.current += amount
    } else if (daysOverdue <= 30) {
      row.days1to30 += amount
    } else if (daysOverdue <= 60) {
      row.days31to60 += amount
    } else if (daysOverdue <= 90) {
      row.days61to90 += amount
    } else {
      row.days90plus += amount
    }
  }

  const rows = Array.from(orgMap.values()).sort((a, b) => b.days90plus - a.days90plus)

  const totals = rows.reduce(
    (acc, r) => ({
      current: acc.current + r.current,
      days1to30: acc.days1to30 + r.days1to30,
      days31to60: acc.days31to60 + r.days31to60,
      days61to90: acc.days61to90 + r.days61to90,
      days90plus: acc.days90plus + r.days90plus,
      total: acc.total + r.total,
    }),
    { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0, total: 0 }
  )

  return { rows, totals }
}

// ── Payment Failure Query ──────────────────────────────────────────────

/**
 * Fetch payment failure analysis report.
 * Uses payment_history table for failed transactions.
 */
export async function fetchPaymentFailureReport(
  supabase: SupabaseClient,
  monthsBack: number = 6
): Promise<PaymentFailureReport> {
  const since = new Date()
  since.setMonth(since.getMonth() - monthsBack)

  const { data: payments, error } = await (supabase as any)
    .from('payment_history')
    .select(`
      id,
      amount_cents,
      status,
      failure_reason,
      created_at,
      organization_id,
      organizations:organization_id(name)
    `)
    .gte('created_at', since.toISOString())
    .in('status', ['failed', 'succeeded'])

  if (error) throw new Error(`Payment failure query failed: ${error.message}`)

  const allPayments = payments ?? []
  const failed = allPayments.filter((p: any) => p.status === 'failed')
  const succeeded = allPayments.filter((p: any) => p.status === 'succeeded')

  // 1. Group by failure reason
  const reasonMap = new Map<string, FailureByReason>()
  for (const p of failed) {
    const reason = (p.failure_reason as string) || 'Unknown'
    if (!reasonMap.has(reason)) {
      reasonMap.set(reason, { reason, count: 0, totalAmount: 0 })
    }
    const r = reasonMap.get(reason)!
    r.count += 1
    r.totalAmount += centsToUsd(p.amount_cents ?? 0)
  }
  const byReason = Array.from(reasonMap.values()).sort((a, b) => b.count - a.count)

  // 2. Monthly trend
  const trendMap = new Map<string, FailureTrendPoint>()
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = getMonthKey(d)
    trendMap.set(key, {
      month: key,
      label: monthLabel(key),
      failedCount: 0,
      failedAmount: 0,
      recoveredCount: 0,
      recoveredAmount: 0,
    })
  }

  for (const p of failed) {
    const key = getMonthKey(new Date(p.created_at))
    const point = trendMap.get(key)
    if (point) {
      point.failedCount += 1
      point.failedAmount += centsToUsd(p.amount_cents ?? 0)
    }
  }

  // Consider a payment "recovered" if there's a later succeeded payment for the same org
  const recoveredOrgMonths = new Set<string>()
  for (const s of succeeded) {
    const key = getMonthKey(new Date(s.created_at))
    const orgKey = `${s.organization_id}_${key}`
    if (!recoveredOrgMonths.has(orgKey)) {
      recoveredOrgMonths.add(orgKey)
      const point = trendMap.get(key)
      if (point) {
        point.recoveredCount += 1
        point.recoveredAmount += centsToUsd(s.amount_cents ?? 0)
      }
    }
  }

  const trend = Array.from(trendMap.values())

  // 3. Top affected organizations
  const orgFailMap = new Map<string, TopFailureOrg>()
  for (const p of failed) {
    const orgId = p.organization_id as string
    if (!orgFailMap.has(orgId)) {
      orgFailMap.set(orgId, {
        organizationId: orgId,
        organizationName: (p.organizations as any)?.name ?? orgId,
        failedCount: 0,
        failedAmount: 0,
      })
    }
    const o = orgFailMap.get(orgId)!
    o.failedCount += 1
    o.failedAmount += centsToUsd(p.amount_cents ?? 0)
  }
  const topOrgs = Array.from(orgFailMap.values())
    .sort((a, b) => b.failedCount - a.failedCount)
    .slice(0, 10)

  // 4. Recovery rate
  const totalFailed = failed.length
  const totalRecovered = succeeded.length
  const recoveryRate = totalFailed > 0
    ? Math.round((totalRecovered / (totalFailed + totalRecovered)) * 100)
    : 0

  return {
    byReason,
    trend,
    topOrgs,
    totalFailed,
    totalRecovered,
    recoveryRate,
  }
}

// ── Tax Summary Query ──────────────────────────────────────────────────

/**
 * Fetch tax / revenue summary grouped by jurisdiction.
 * Uses organization billing_address or falls back to org country/state.
 */
export async function fetchTaxSummaryReport(
  supabase: SupabaseClient,
  year?: number
): Promise<TaxSummaryReport> {
  const targetYear = year ?? new Date().getFullYear()
  const startDate = `${targetYear}-01-01T00:00:00Z`
  const endDate = `${targetYear + 1}-01-01T00:00:00Z`

  const { data: invoices, error } = await (supabase as any)
    .from('invoices')
    .select(`
      id,
      amount_cents,
      status,
      created_at,
      organization_id,
      organizations:organization_id(name, settings)
    `)
    .in('status', ['paid', 'open', 'overdue', 'sent'])
    .gte('created_at', startDate)
    .lt('created_at', endDate)

  if (error) throw new Error(`Tax summary query failed: ${error.message}`)

  // Build quarterly buckets
  const quarterMap = new Map<string, QuarterlyTaxSummary>()
  const annualJurisdictions = new Map<string, JurisdictionRevenue>()
  const orgSet = new Map<string, Set<string>>() // jurisdiction -> org IDs

  for (const inv of invoices ?? []) {
    const amount = centsToUsd(inv.amount_cents ?? 0)
    const createdAt = new Date(inv.created_at)
    const q = Math.ceil((createdAt.getMonth() + 1) / 3)
    const qKey = `Q${q} ${targetYear}`

    // Extract jurisdiction from org settings or default
    const orgSettings = (inv.organizations as any)?.settings
    const billingAddress = orgSettings?.billing_address
    const state = billingAddress?.state || 'Unknown'
    const country = billingAddress?.country || 'US'
    const jurisdiction = state !== 'Unknown' ? `${state}, ${country}` : country
    const orgId = inv.organization_id as string

    // Quarterly
    if (!quarterMap.has(qKey)) {
      quarterMap.set(qKey, {
        quarter: qKey,
        year: targetYear,
        quarterNum: q,
        totalRevenue: 0,
        jurisdictions: [],
      })
    }
    const quarter = quarterMap.get(qKey)!
    quarter.totalRevenue += amount

    // Track jurisdiction data (we'll aggregate after)
    const jKey = `${qKey}_${jurisdiction}`
    if (!orgSet.has(jKey)) orgSet.set(jKey, new Set())
    orgSet.get(jKey)!.add(orgId)

    // Annual jurisdiction
    if (!annualJurisdictions.has(jurisdiction)) {
      annualJurisdictions.set(jurisdiction, {
        jurisdiction,
        state,
        country,
        revenue: 0,
        invoiceCount: 0,
        customerCount: 0,
      })
    }
    const aj = annualJurisdictions.get(jurisdiction)!
    aj.revenue += amount
    aj.invoiceCount += 1

    // Annual org tracking
    const annualOrgKey = `annual_${jurisdiction}`
    if (!orgSet.has(annualOrgKey)) orgSet.set(annualOrgKey, new Set())
    orgSet.get(annualOrgKey)!.add(orgId)
  }

  // Set customer counts
  for (const [key, orgs] of orgSet.entries()) {
    if (key.startsWith('annual_')) {
      const j = key.replace('annual_', '')
      const aj = annualJurisdictions.get(j)
      if (aj) aj.customerCount = orgs.size
    }
  }

  // Build quarterly jurisdiction lists
  // Re-process invoices for quarterly jurisdictions
  const qJurisdictions = new Map<string, Map<string, JurisdictionRevenue>>()

  for (const inv of invoices ?? []) {
    const amount = centsToUsd(inv.amount_cents ?? 0)
    const createdAt = new Date(inv.created_at)
    const q = Math.ceil((createdAt.getMonth() + 1) / 3)
    const qKey = `Q${q} ${targetYear}`
    const orgSettings = (inv.organizations as any)?.settings
    const billingAddress = orgSettings?.billing_address
    const state = billingAddress?.state || 'Unknown'
    const country = billingAddress?.country || 'US'
    const jurisdiction = state !== 'Unknown' ? `${state}, ${country}` : country
    const orgId = inv.organization_id as string

    if (!qJurisdictions.has(qKey)) qJurisdictions.set(qKey, new Map())
    const jMap = qJurisdictions.get(qKey)!
    if (!jMap.has(jurisdiction)) {
      jMap.set(jurisdiction, {
        jurisdiction,
        state,
        country,
        revenue: 0,
        invoiceCount: 0,
        customerCount: 0,
      })
    }
    const j = jMap.get(jurisdiction)!
    j.revenue += amount
    j.invoiceCount += 1

    const jOrgKey = `${qKey}_${jurisdiction}`
    j.customerCount = orgSet.get(jOrgKey)?.size ?? 0
  }

  // Attach jurisdictions to quarters
  for (const [qKey, quarter] of quarterMap.entries()) {
    quarter.jurisdictions = Array.from(qJurisdictions.get(qKey)?.values() ?? [])
      .sort((a, b) => b.revenue - a.revenue)
  }

  const quarterly = Array.from(quarterMap.values()).sort(
    (a, b) => a.quarterNum - b.quarterNum
  )

  const annual = [
    {
      year: targetYear,
      totalRevenue: quarterly.reduce((s, q) => s + q.totalRevenue, 0),
      jurisdictions: Array.from(annualJurisdictions.values()).sort(
        (a, b) => b.revenue - a.revenue
      ),
    },
  ]

  return { quarterly, annual }
}

// ── CSV Export Utilities ───────────────────────────────────────────────

/** Convert AR aging report to CSV */
export function arAgingToCsv(report: ARAgingSummary): string {
  const header = 'Organization,Current,1-30 Days,31-60 Days,61-90 Days,90+ Days,Total'
  const rows = report.rows.map(
    (r) =>
      `"${r.organizationName}",${r.current.toFixed(2)},${r.days1to30.toFixed(2)},${r.days31to60.toFixed(2)},${r.days61to90.toFixed(2)},${r.days90plus.toFixed(2)},${r.total.toFixed(2)}`
  )
  const totalRow = `"TOTAL",${report.totals.current.toFixed(2)},${report.totals.days1to30.toFixed(2)},${report.totals.days31to60.toFixed(2)},${report.totals.days61to90.toFixed(2)},${report.totals.days90plus.toFixed(2)},${report.totals.total.toFixed(2)}`
  return [header, ...rows, totalRow].join('\n')
}

/** Convert payment failure report to CSV */
export function paymentFailureToCsv(report: PaymentFailureReport): string {
  const sections: string[] = []

  // By reason
  sections.push('Payment Failures by Reason')
  sections.push('Reason,Count,Total Amount')
  for (const r of report.byReason) {
    sections.push(`"${r.reason}",${r.count},${r.totalAmount.toFixed(2)}`)
  }

  sections.push('')
  sections.push('Monthly Trend')
  sections.push('Month,Failed Count,Failed Amount,Recovered Count,Recovered Amount')
  for (const t of report.trend) {
    sections.push(
      `${t.label},${t.failedCount},${t.failedAmount.toFixed(2)},${t.recoveredCount},${t.recoveredAmount.toFixed(2)}`
    )
  }

  sections.push('')
  sections.push('Top Affected Organizations')
  sections.push('Organization,Failed Count,Failed Amount')
  for (const o of report.topOrgs) {
    sections.push(`"${o.organizationName}",${o.failedCount},${o.failedAmount.toFixed(2)}`)
  }

  sections.push('')
  sections.push(`Recovery Rate,${report.recoveryRate}%`)

  return sections.join('\n')
}

/** Convert tax summary to CSV */
export function taxSummaryToCsv(report: TaxSummaryReport): string {
  const sections: string[] = []

  for (const q of report.quarterly) {
    sections.push(`${q.quarter}`)
    sections.push('Jurisdiction,Revenue,Invoices,Customers')
    for (const j of q.jurisdictions) {
      sections.push(`"${j.jurisdiction}",${j.revenue.toFixed(2)},${j.invoiceCount},${j.customerCount}`)
    }
    sections.push(`Total,${q.totalRevenue.toFixed(2)},,`)
    sections.push('')
  }

  if (report.annual.length > 0) {
    const a = report.annual[0]!
    sections.push(`Annual Summary ${a.year}`)
    sections.push('Jurisdiction,Revenue,Invoices,Customers')
    for (const j of a.jurisdictions) {
      sections.push(`"${j.jurisdiction}",${j.revenue.toFixed(2)},${j.invoiceCount},${j.customerCount}`)
    }
    sections.push(`Total,${a.totalRevenue.toFixed(2)},,`)
  }

  return sections.join('\n')
}
