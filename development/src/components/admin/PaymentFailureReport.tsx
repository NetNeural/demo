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
import type { PaymentFailureReport as PaymentFailureData } from '@/lib/admin/financial-report-queries'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import { AlertCircle, TrendingDown, CheckCircle2, Building2 } from 'lucide-react'

interface PaymentFailureReportProps {
  data: PaymentFailureData | null
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

const REASON_COLORS: Record<string, string> = {
  card_declined: 'bg-red-500/10 text-red-600',
  insufficient_funds: 'bg-amber-500/10 text-amber-600',
  expired_card: 'bg-orange-500/10 text-orange-600',
  processing_error: 'bg-blue-500/10 text-blue-600',
  authentication_required: 'bg-purple-500/10 text-purple-600',
}

function getReasonStyle(reason: string): string {
  const lower = reason.toLowerCase().replace(/\s+/g, '_')
  for (const [key, style] of Object.entries(REASON_COLORS)) {
    if (lower.includes(key)) return style
  }
  return 'bg-muted text-muted-foreground'
}

export function PaymentFailureReport({ data, loading }: PaymentFailureReportProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-1 h-4 w-72" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Payment Failure Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Failed</p>
                <p className="text-2xl font-bold text-red-600">{data.totalFailed}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Recovered</p>
                <p className="text-2xl font-bold text-emerald-600">{data.totalRecovered}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Recovery Rate</p>
                <p className="text-2xl font-bold">{data.recoveryRate}%</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Failure trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingDown className="h-5 w-5" />
            Payment Failure Trend
          </CardTitle>
          <CardDescription>Failed vs recovered payments over time</CardDescription>
        </CardHeader>
        <CardContent>
          {data.trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value: any) => fmtUsd(Number(value))}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar
                  dataKey="failedAmount"
                  name="Failed"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="recoveredAmount"
                  name="Recovered"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No trend data available.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Failures by reason */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5" />
            Failures by Reason
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.byReason.length > 0 ? (
            <div className="space-y-3">
              {data.byReason.map((r) => (
                <div
                  key={r.reason}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={getReasonStyle(r.reason)}>
                      {r.reason}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {r.count} occurrence{r.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-medium">
                    {fmtUsd(r.totalAmount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No payment failures recorded.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Top affected organizations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            Top Affected Organizations
          </CardTitle>
          <CardDescription>Organizations with the most payment failures</CardDescription>
        </CardHeader>
        <CardContent>
          {data.topOrgs.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead className="text-right">Failed Count</TableHead>
                    <TableHead className="text-right">Failed Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topOrgs.map((org) => (
                    <TableRow key={org.organizationId}>
                      <TableCell className="font-medium">
                        {org.organizationName}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive" className="font-mono">
                          {org.failedCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmtUsd(org.failedAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No affected organizations.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
