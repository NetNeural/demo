/**
 * Invoice query helpers for Supabase
 * Used by the /dashboard/billing/invoices page (#54)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { InvoiceStatus } from '@/types/billing'

/** Columns selected for the invoice list */
const INVOICE_SELECT = `
  id,
  organization_id,
  subscription_id,
  stripe_invoice_id,
  amount_cents,
  currency,
  status,
  invoice_url,
  pdf_url,
  period_start,
  period_end,
  created_at,
  subscription:subscriptions(billing_plan:plan_id(name))
` as const

/** Row shape returned by the invoice list query */
export interface InvoiceRow {
  id: string
  organization_id: string
  subscription_id: string | null
  stripe_invoice_id: string | null
  amount_cents: number
  currency: string
  status: InvoiceStatus
  invoice_url: string | null
  pdf_url: string | null
  period_start: string | null
  period_end: string | null
  created_at: string
  subscription?: {
    billing_plan?: {
      name: string
    }
  } | null
}

/** Filter options for the invoice list query */
export interface InvoiceFilters {
  organizationId: string
  status?: InvoiceStatus | 'overdue' | 'all'
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

/** Result of a paginated invoice query */
export interface InvoiceQueryResult {
  data: InvoiceRow[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Fetch paginated invoices with optional status and date filters.
 * Uses Supabase .range() for server-side pagination.
 */
export async function fetchInvoices(
  supabase: SupabaseClient,
  filters: InvoiceFilters
): Promise<InvoiceQueryResult> {
  const {
    organizationId,
    status = 'all',
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 20,
  } = filters

  const offset = (page - 1) * pageSize

  // Build query — cast needed because invoices table may not be in generated types
  let query = (supabase as any)
    .from('invoices')
    .select(INVOICE_SELECT, { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  // Status filter
  if (status === 'overdue') {
    // Overdue = open + due date past
    query = query
      .eq('status', 'open')
      .lt('period_end', new Date().toISOString())
  } else if (status !== 'all') {
    query = query.eq('status', status)
  }

  // Date range filters
  if (dateFrom) {
    query = query.gte('created_at', dateFrom)
  }
  if (dateTo) {
    // Add a day to include the full end date
    const endDate = new Date(dateTo)
    endDate.setDate(endDate.getDate() + 1)
    query = query.lt('created_at', endDate.toISOString())
  }

  // Pagination
  query = query.range(offset, offset + pageSize - 1)

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching invoices:', error)
    throw new Error(`Failed to fetch invoices: ${error.message}`)
  }

  const totalCount = count ?? 0

  return {
    data: (data ?? []) as InvoiceRow[],
    count: totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  }
}

/**
 * Fetch invoice status counts for the filter tabs.
 * Returns count per status + overdue count.
 */
export async function fetchInvoiceStatusCounts(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {
    all: 0,
    paid: 0,
    open: 0,
    overdue: 0,
    void: 0,
    draft: 0,
  }

  // Total count
  const { count: total } = await (supabase as any)
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  counts.all = total ?? 0

  // Per-status counts
  for (const status of ['paid', 'open', 'void', 'draft'] as InvoiceStatus[]) {
    const { count } = await (supabase as any)
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', status)

    counts[status] = count ?? 0
  }

  // Overdue = open + past due date
  const { count: overdueCount } = await (supabase as any)
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .lt('period_end', new Date().toISOString())

  counts.overdue = overdueCount ?? 0

  return counts
}
