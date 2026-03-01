'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { ARAgingSummary } from '@/lib/admin/financial-report-queries'
import { DollarSign, AlertTriangle } from 'lucide-react'

interface ARAgingReportProps {
  data: ARAgingSummary | null
  loading?: boolean
}

function fmtUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function getBucketBadge(amount: number, bucket: string) {
  if (amount <= 0) return <span className="text-muted-foreground">—</span>

  const variant =
    bucket === 'current'
      ? 'outline'
      : bucket === '90+'
        ? 'destructive'
        : 'secondary'

  return (
    <Badge variant={variant} className="font-mono text-xs">
      {fmtUsd(amount)}
    </Badge>
  )
}

export function ARAgingReport({ data, loading }: ARAgingReportProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-1 h-4 w-72" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Accounts Receivable Aging
          </CardTitle>
          <CardDescription>Outstanding invoices by aging bucket</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <DollarSign className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No outstanding receivables found.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasOverdue =
    data.totals.days31to60 > 0 ||
    data.totals.days61to90 > 0 ||
    data.totals.days90plus > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Accounts Receivable Aging
          {hasOverdue && (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </CardTitle>
        <CardDescription>
          Outstanding invoices by aging bucket &middot; {data.rows.length} org
          {data.rows.length !== 1 ? 's' : ''} with open invoices
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-3 gap-4 sm:grid-cols-6">
          {[
            { label: 'Current', value: data.totals.current },
            { label: '1-30 Days', value: data.totals.days1to30 },
            { label: '31-60 Days', value: data.totals.days31to60 },
            { label: '61-90 Days', value: data.totals.days61to90 },
            { label: '90+ Days', value: data.totals.days90plus },
            { label: 'Total', value: data.totals.total },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border p-3 text-center"
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-bold">{fmtUsd(value)}</p>
            </div>
          ))}
        </div>

        {/* Detail table */}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Organization</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">1-30 Days</TableHead>
                <TableHead className="text-right">31-60 Days</TableHead>
                <TableHead className="text-right">61-90 Days</TableHead>
                <TableHead className="text-right">90+ Days</TableHead>
                <TableHead className="text-right font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.organizationId}>
                  <TableCell className="font-medium">
                    {row.organizationName}
                  </TableCell>
                  <TableCell className="text-right">
                    {getBucketBadge(row.current, 'current')}
                  </TableCell>
                  <TableCell className="text-right">
                    {getBucketBadge(row.days1to30, '1-30')}
                  </TableCell>
                  <TableCell className="text-right">
                    {getBucketBadge(row.days31to60, '31-60')}
                  </TableCell>
                  <TableCell className="text-right">
                    {getBucketBadge(row.days61to90, '61-90')}
                  </TableCell>
                  <TableCell className="text-right">
                    {getBucketBadge(row.days90plus, '90+')}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {fmtUsd(row.total)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">{fmtUsd(data.totals.current)}</TableCell>
                <TableCell className="text-right">{fmtUsd(data.totals.days1to30)}</TableCell>
                <TableCell className="text-right">{fmtUsd(data.totals.days31to60)}</TableCell>
                <TableCell className="text-right">{fmtUsd(data.totals.days61to90)}</TableCell>
                <TableCell className="text-right">{fmtUsd(data.totals.days90plus)}</TableCell>
                <TableCell className="text-right">{fmtUsd(data.totals.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
