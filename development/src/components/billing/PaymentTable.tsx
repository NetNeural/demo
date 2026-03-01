'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Inbox,
  AlertTriangle,
  Download,
  FileDown,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { PaymentMethodIcon } from '@/components/billing/PaymentMethodIcon'
import { RetryPaymentButton } from '@/components/billing/RetryPaymentButton'
import { formatInvoiceAmount, formatPaymentStatus } from '@/types/billing'
import type { PaymentStatus } from '@/types/billing'
import {
  fetchPayments,
  fetchPaymentStatusCounts,
  hasFailedPayments,
  paymentsToCsv,
  type PaymentRow,
  type PaymentQueryResult,
} from '@/lib/billing/payment-queries'

// Lazy singleton
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

/** Tab definition for status filters */
interface StatusTab {
  key: string
  label: string
}

const STATUS_TABS: StatusTab[] = [
  { key: 'all', label: 'All' },
  { key: 'succeeded', label: 'Succeeded' },
  { key: 'failed', label: 'Failed' },
  { key: 'refunded', label: 'Refunded' },
  { key: 'pending', label: 'Pending' },
]

/** Status badge color map */
const STATUS_STYLES: Record<PaymentStatus, string> = {
  succeeded:
    'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200',
  failed:
    'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200',
  pending:
    'bg-yellow-100 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200',
  refunded:
    'bg-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300',
  requires_action:
    'bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-200',
}

const STATUS_ICONS: Record<PaymentStatus, React.ReactNode> = {
  succeeded: <CheckCircle2 className="mr-1 h-3 w-3" />,
  failed: <XCircle className="mr-1 h-3 w-3" />,
  pending: <Clock className="mr-1 h-3 w-3" />,
  refunded: <RotateCcw className="mr-1 h-3 w-3" />,
  requires_action: <ShieldAlert className="mr-1 h-3 w-3" />,
}

interface PaymentTableProps {
  organizationId: string
  /** Whether the user can retry payments (canManageBilling) */
  canManage?: boolean
}

export function PaymentTable({
  organizationId,
  canManage = false,
}: PaymentTableProps) {
  const { fmt } = useDateFormatter()
  const [activeTab, setActiveTab] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [result, setResult] = useState<PaymentQueryResult | null>(null)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [showFailedBanner, setShowFailedBanner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const loadPayments = useCallback(async () => {
    try {
      const supabase = getSupabase()
      const data = await fetchPayments(supabase, {
        organizationId,
        status: activeTab as PaymentStatus | 'all',
        page,
        pageSize,
      })
      setResult(data)
    } catch (err) {
      console.error('Failed to load payments:', err)
    }
  }, [organizationId, activeTab, page, pageSize])

  const loadCounts = useCallback(async () => {
    try {
      const supabase = getSupabase()
      const [counts, hasFailed] = await Promise.all([
        fetchPaymentStatusCounts(supabase, organizationId),
        hasFailedPayments(supabase, organizationId),
      ])
      setStatusCounts(counts)
      setShowFailedBanner(hasFailed)
    } catch {
      // Best-effort
    }
  }, [organizationId])

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([loadPayments(), loadCounts()])
      setLoading(false)
    }
    load()
  }, [loadPayments, loadCounts])

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadPayments(), loadCounts()])
    setRefreshing(false)
  }

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [activeTab])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  // Handle retry complete
  const handleRetryComplete = (success: boolean, message: string) => {
    setToast({ type: success ? 'success' : 'error', message })
    if (success) {
      // Refresh data after successful retry
      handleRefresh()
    }
  }

  // Export CSV
  const handleExportCsv = () => {
    if (!result?.data.length) return
    const csv = paymentsToCsv(result.data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payment-history-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <PaymentTableSkeleton />
  }

  const payments = result?.data ?? []
  const totalPages = result?.totalPages ?? 1

  return (
    <div className="space-y-4">
      {/* Failed payment alert banner */}
      {showFailedBanner && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed Payments</AlertTitle>
          <AlertDescription>
            One or more payments have failed. Please update your payment method
            or retry the failed payments below.
          </AlertDescription>
        </Alert>
      )}

      {/* Toast notification */}
      {toast && (
        <Alert
          variant={toast.type === 'error' ? 'destructive' : 'default'}
          className={
            toast.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200'
              : ''
          }
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>{toast.message}</AlertDescription>
        </Alert>
      )}

      {/* Status filter tabs + actions */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => {
          const count = statusCounts[tab.key] ?? 0
          const isActive = activeTab === tab.key
          return (
            <Button
              key={tab.key}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
              className="gap-1.5"
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
              )}
            </Button>
          )
        })}

        <div className="ml-auto flex items-center gap-1">
          {payments.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              title="Export to CSV"
            >
              <FileDown className="mr-1 h-4 w-4" />
              Export CSV
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </div>

      {/* Desktop table */}
      {payments.length > 0 ? (
        <>
          <div className="hidden md:block">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{fmt.shortDate(p.created_at)}</TableCell>
                      <TableCell className="font-medium">
                        {formatInvoiceAmount(p.amount_cents, p.currency)}
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={p.status} />
                      </TableCell>
                      <TableCell>
                        <PaymentMethodIcon
                          brand={p.card_brand}
                          last4={p.card_last4}
                          methodType={p.payment_method_type}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {p.invoice?.stripe_invoice_id
                          ? `#${p.invoice.stripe_invoice_id.slice(-8).toUpperCase()}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <PaymentActions
                          payment={p}
                          canManage={canManage}
                          onRetryComplete={handleRetryComplete}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile card layout */}
          <div className="space-y-3 md:hidden">
            {payments.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {fmt.shortDate(p.created_at)}
                      </p>
                      <p className="text-lg font-semibold">
                        {formatInvoiceAmount(p.amount_cents, p.currency)}
                      </p>
                    </div>
                    <PaymentStatusBadge status={p.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <PaymentMethodIcon
                      brand={p.card_brand}
                      last4={p.card_last4}
                      methodType={p.payment_method_type}
                    />
                    <PaymentActions
                      payment={p}
                      canManage={canManage}
                      onRetryComplete={handleRetryComplete}
                    />
                  </div>
                  {p.failure_message && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                      {p.failure_message}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({result?.count ?? 0} payments)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12">
          <Inbox className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No payments found</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            {activeTab !== 'all'
              ? `No ${activeTab} payments. Try a different filter.`
              : 'No payment transactions yet. Payments appear here after charges are processed.'}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge className={STATUS_STYLES[status]}>
      {STATUS_ICONS[status]}
      {formatPaymentStatus(status)}
    </Badge>
  )
}

function PaymentActions({
  payment,
  canManage,
  onRetryComplete,
}: {
  payment: PaymentRow
  canManage: boolean
  onRetryComplete: (success: boolean, message: string) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {/* Retry button — only for failed payments with canManageBilling */}
      {canManage && payment.status === 'failed' && (
        <RetryPaymentButton
          paymentId={payment.id}
          stripePaymentIntent={payment.stripe_payment_intent}
          retryCount={payment.retry_count}
          lastRetryAt={payment.last_retry_at}
          onRetryComplete={onRetryComplete}
        />
      )}

      {/* Download receipt */}
      {payment.receipt_url && (
        <Button variant="ghost" size="sm" asChild>
          <a
            href={payment.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Download Receipt"
          >
            <Download className="mr-1 h-3 w-3" />
            <span className="hidden sm:inline">Receipt</span>
          </a>
        </Button>
      )}

      {/* Link to invoice */}
      {payment.invoice_id && (
        <Button variant="ghost" size="sm" asChild>
          <a href="/dashboard/billing/invoices" title="View Invoice">
            <ExternalLink className="mr-1 h-3 w-3" />
            <span className="hidden sm:inline">Invoice</span>
          </a>
        </Button>
      )}
    </div>
  )
}

// ── Skeleton ──

function PaymentTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-md" />
        ))}
      </div>
      <div className="rounded-md border">
        <div className="border-b p-4">
          <div className="flex gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b p-4 last:border-0">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-8 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
