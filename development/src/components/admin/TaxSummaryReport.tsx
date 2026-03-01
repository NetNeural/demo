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
import type { TaxSummaryReport as TaxSummaryData, JurisdictionRevenue } from '@/lib/admin/financial-report-queries'
import { Receipt, MapPin } from 'lucide-react'

interface TaxSummaryReportProps {
  data: TaxSummaryData | null
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

function JurisdictionTable({ jurisdictions }: { jurisdictions: JurisdictionRevenue[] }) {
  if (jurisdictions.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No revenue data for this period.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[180px]">Jurisdiction</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Invoices</TableHead>
            <TableHead className="text-right">Customers</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jurisdictions.map((j) => (
            <TableRow key={j.jurisdiction}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{j.jurisdiction}</span>
                </div>
              </TableCell>
              <TableCell className="text-right font-mono">
                {fmtUsd(j.revenue)}
              </TableCell>
              <TableCell className="text-right">{j.invoiceCount}</TableCell>
              <TableCell className="text-right">{j.customerCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function TaxSummaryReport({ data, loading }: TaxSummaryReportProps) {
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

  if (!data || (data.quarterly.length === 0 && data.annual.length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Tax Summary
          </CardTitle>
          <CardDescription>Revenue by jurisdiction for tax reporting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Receipt className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No tax data available for the selected period.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Quarterly breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5" />
            Quarterly Tax Summary
          </CardTitle>
          <CardDescription>
            Revenue by jurisdiction per quarter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {data.quarterly.map((q) => (
              <div key={q.quarter}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">{q.quarter}</span>
                  <Badge variant="outline" className="font-mono">
                    {fmtUsd(q.totalRevenue)}
                  </Badge>
                </div>
                <JurisdictionTable jurisdictions={q.jurisdictions} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Annual summary */}
      {data.annual.map((a) => (
        <Card key={a.year}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5" />
              Annual Summary — {a.year}
            </CardTitle>
            <CardDescription>
              Total revenue: {fmtUsd(a.totalRevenue)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JurisdictionTable jurisdictions={a.jurisdictions} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
