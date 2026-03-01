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
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ExternalLink,
  FileText,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  RefreshCw,
  Inbox,
} from 'lucide-react'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { InvoiceStatusBadge } from '@/components/billing/InvoiceStatusBadge'
import { formatInvoiceAmount } from '@/types/billing'
import type { InvoiceStatus } from '@/types/billing'
import {
  fetchInvoices,
  fetchInvoiceStatusCounts,
  type InvoiceRow,
  type InvoiceQueryResult,
} from '@/lib/billing/invoice-queries'

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
  { key: 'paid', label: 'Paid' },
  { key: 'open', label: 'Open' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'void', label: 'Void' },
]

interface InvoiceTableProps {
  organizationId: string
  /** Whether the user can initiate payments (canManageBilling) */
  canManage?: boolean
}

export function InvoiceTable({
  organizationId,
  canManage = false,
}: InvoiceTableProps) {
  const { fmt } = useDateFormatter()
  const [activeTab, setActiveTab] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [result, setResult] = useState<InvoiceQueryResult | null>(null)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadInvoices = useCallback(async () => {
    try {
      const supabase = getSupabase()
      const data = await fetchInvoices(supabase, {
        organizationId,
        status: activeTab as InvoiceStatus | 'overdue' | 'all',
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize,
      })
      setResult(data)
    } catch (err) {
      console.error('Failed to load invoices:', err)
    }
  }, [organizationId, activeTab, dateFrom, dateTo, page, pageSize])

  const loadCounts = useCallback(async () => {
    try {
      const supabase = getSupabase()
      const counts = await fetchInvoiceStatusCounts(supabase, organizationId)
      setStatusCounts(counts)
    } catch {
      // Best-effort
    }
  }, [organizationId])

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([loadInvoices(), loadCounts()])
      setLoading(false)
    }
    load()
  }, [loadInvoices, loadCounts])

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadInvoices(), loadCounts()])
    setRefreshing(false)
  }

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [activeTab, dateFrom, dateTo])

  /** Check if an invoice is overdue (open + past period_end) */
  const isOverdue = (inv: InvoiceRow): boolean => {
    if (inv.status !== 'open' || !inv.period_end) return false
    return new Date(inv.period_end) < new Date()
  }

  /** Generate a Stripe payment link (falls back to invoice_url) */
  const getPaymentUrl = (inv: InvoiceRow): string | null => {
    return inv.invoice_url
  }

  if (loading) {
    return <InvoiceTableSkeleton />
  }

  const invoices = result?.data ?? []
  const totalPages = result?.totalPages ?? 1

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
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

        <div className="ml-auto">
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

      {/* Date range filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">From</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-[150px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">To</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-[150px]"
          />
        </div>
        {(dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFrom('')
              setDateTo('')
            }}
          >
            Clear dates
          </Button>
        )}
      </div>

      {/* Desktop table */}
      {invoices.length > 0 ? (
        <>
          <div className="hidden md:block">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">
                        {inv.stripe_invoice_id
                          ? `#${inv.stripe_invoice_id.slice(-8).toUpperCase()}`
                          : `#${inv.id.slice(0, 8).toUpperCase()}`}
                      </TableCell>
                      <TableCell>{fmt.shortDate(inv.created_at)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {inv.subscription?.billing_plan?.name ?? '—'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatInvoiceAmount(inv.amount_cents, inv.currency)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge
                          status={inv.status}
                          overdue={isOverdue(inv)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {inv.period_end ? fmt.shortDate(inv.period_end) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <InvoiceActions
                          invoice={inv}
                          canManage={canManage}
                          isOverdue={isOverdue(inv)}
                          paymentUrl={getPaymentUrl(inv)}
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
            {invoices.map((inv) => (
              <Card key={inv.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-mono text-sm font-medium">
                        {inv.stripe_invoice_id
                          ? `#${inv.stripe_invoice_id.slice(-8).toUpperCase()}`
                          : `#${inv.id.slice(0, 8).toUpperCase()}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {fmt.shortDate(inv.created_at)}
                      </p>
                    </div>
                    <InvoiceStatusBadge
                      status={inv.status}
                      overdue={isOverdue(inv)}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold">
                        {formatInvoiceAmount(inv.amount_cents, inv.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inv.subscription?.billing_plan?.name ?? 'Unknown plan'}
                      </p>
                    </div>
                    <InvoiceActions
                      invoice={inv}
                      canManage={canManage}
                      isOverdue={isOverdue(inv)}
                      paymentUrl={getPaymentUrl(inv)}
                    />
                  </div>
                  {inv.period_end && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Due: {fmt.shortDate(inv.period_end)}
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
                Page {page} of {totalPages} ({result?.count ?? 0} invoices)
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
          <h3 className="text-lg font-semibold">No invoices found</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            {activeTab !== 'all'
              ? `No ${activeTab} invoices. Try a different filter.`
              : 'Your organization doesn\u2019t have any invoices yet. Invoices appear here after your first billing cycle.'}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Action buttons per invoice row ──

function InvoiceActions({
  invoice,
  canManage,
  isOverdue,
  paymentUrl,
}: {
  invoice: InvoiceRow
  canManage: boolean
  isOverdue: boolean
  paymentUrl: string | null
}) {
  const showPayNow =
    canManage && (invoice.status === 'open' || isOverdue) && paymentUrl

  return (
    <div className="flex items-center gap-1">
      {showPayNow && (
        <Button variant="default" size="sm" asChild>
          <a href={paymentUrl!} target="_blank" rel="noopener noreferrer">
            <CreditCard className="mr-1 h-3 w-3" />
            Pay Now
          </a>
        </Button>
      )}
      {invoice.pdf_url && (
        <Button variant="ghost" size="sm" asChild>
          <a
            href={invoice.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Download PDF"
          >
            <FileText className="mr-1 h-3 w-3" />
            <span className="hidden sm:inline">PDF</span>
          </a>
        </Button>
      )}
      {invoice.invoice_url && (
        <Button variant="ghost" size="sm" asChild>
          <a
            href={invoice.invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            title="View on Stripe"
          >
            <ExternalLink className="mr-1 h-3 w-3" />
            <span className="hidden sm:inline">View</span>
          </a>
        </Button>
      )}
    </div>
  )
}

// ── Skeleton loader ──

function InvoiceTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Tab skeletons */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>
      {/* Date filter skeletons */}
      <div className="flex gap-3">
        <Skeleton className="h-8 w-[180px]" />
        <Skeleton className="h-8 w-[180px]" />
      </div>
      {/* Table skeletons */}
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
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-8 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
