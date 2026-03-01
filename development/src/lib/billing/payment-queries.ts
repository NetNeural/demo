/**
 * Payment history query helpers for Supabase
 * Used by the /dashboard/billing/payments page (#55)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentStatus } from '@/types/billing'

/** Columns selected for the payment history list */
const PAYMENT_SELECT = `
  id,
  organization_id,
  invoice_id,
  stripe_payment_intent,
  stripe_charge_id,
  amount_cents,
  currency,
  status,
  payment_method_type,
  card_brand,
  card_last4,
  receipt_url,
  failure_code,
  failure_message,
  retry_count,
  last_retry_at,
  created_at,
  invoice:invoices(stripe_invoice_id, subscription:subscriptions(billing_plan:plan_id(name)))
` as const

/** Row shape returned by the payment history query */
export interface PaymentRow {
  id: string
  organization_id: string
  invoice_id: string | null
  stripe_payment_intent: string | null
  stripe_charge_id: string | null
  amount_cents: number
  currency: string
  status: PaymentStatus
  payment_method_type: string | null
  card_brand: string | null
  card_last4: string | null
  receipt_url: string | null
  failure_code: string | null
  failure_message: string | null
  retry_count: number
  last_retry_at: string | null
  created_at: string
  invoice?: {
    stripe_invoice_id: string | null
    subscription?: {
      billing_plan?: {
        name: string
      }
    } | null
  } | null
}

/** Filter options for the payment history query */
export interface PaymentFilters {
  organizationId: string
  status?: PaymentStatus | 'all'
  page?: number
  pageSize?: number
}

/** Result of a paginated payment query */
export interface PaymentQueryResult {
  data: PaymentRow[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Fetch paginated payment history with optional status filter.
 */
export async function fetchPayments(
  supabase: SupabaseClient,
  filters: PaymentFilters
): Promise<PaymentQueryResult> {
  const {
    organizationId,
    status = 'all',
    page = 1,
    pageSize = 20,
  } = filters

  const offset = (page - 1) * pageSize

  let query = (supabase as any)
    .from('payment_history')
    .select(PAYMENT_SELECT, { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  query = query.range(offset, offset + pageSize - 1)

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching payments:', error)
    throw new Error(`Failed to fetch payments: ${error.message}`)
  }

  const totalCount = count ?? 0

  return {
    data: (data ?? []) as PaymentRow[],
    count: totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  }
}

/**
 * Fetch payment status counts for the filter tabs.
 */
export async function fetchPaymentStatusCounts(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {
    all: 0,
    succeeded: 0,
    failed: 0,
    refunded: 0,
    pending: 0,
  }

  const { count: total } = await (supabase as any)
    .from('payment_history')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  counts.all = total ?? 0

  for (const status of ['succeeded', 'failed', 'refunded', 'pending'] as PaymentStatus[]) {
    const { count } = await (supabase as any)
      .from('payment_history')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', status)

    counts[status] = count ?? 0
  }

  return counts
}

/**
 * Check if there are any failed payments for the org (for the alert banner).
 */
export async function hasFailedPayments(
  supabase: SupabaseClient,
  organizationId: string
): Promise<boolean> {
  const { count } = await (supabase as any)
    .from('payment_history')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'failed')

  return (count ?? 0) > 0
}

/**
 * Export payment records as CSV rows.
 */
export function paymentsToCsv(payments: PaymentRow[]): string {
  const headers = [
    'Date',
    'Amount',
    'Currency',
    'Status',
    'Payment Method',
    'Card Last 4',
    'Invoice #',
    'Failure Reason',
  ]

  const rows = payments.map((p) => [
    new Date(p.created_at).toISOString(),
    (p.amount_cents / 100).toFixed(2),
    p.currency.toUpperCase(),
    p.status,
    p.payment_method_type ?? '',
    p.card_last4 ?? '',
    p.invoice?.stripe_invoice_id ?? '',
    p.failure_message ?? '',
  ])

  const csvLines = [
    headers.join(','),
    ...rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')),
  ]

  return csvLines.join('\n')
}
