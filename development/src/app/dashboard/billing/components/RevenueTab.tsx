'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { RevenueSummaryCards } from '@/components/admin/RevenueSummaryCards'
import { MRRTrendChart } from '@/components/admin/MRRTrendChart'
import { RevenueByPlanChart } from '@/components/admin/RevenueByPlanChart'
import { ChurnWaterfallChart } from '@/components/admin/ChurnWaterfallChart'
import {
  fetchRevenueSummary,
  fetchMrrTrend,
  fetchRevenueByPlan,
  fetchCustomersByPlan,
  fetchMrrWaterfall,
  revenueDataToCsv,
} from '@/lib/admin/revenue-queries'
import type {
  RevenueSummary,
  MrrDataPoint,
  PlanRevenue,
  PlanCustomerCount,
  WaterfallDataPoint,
} from '@/lib/admin/revenue-queries'
import { Download, RefreshCw, FileDown } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

type DateRange = '30' | '90' | '180' | '365'

export function RevenueTab() {
  const [dateRange, setDateRange] = useState<DateRange>('365')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [summary, setSummary] = useState<RevenueSummary | null>(null)
  const [mrrTrend, setMrrTrend] = useState<MrrDataPoint[]>([])
  const [planRevenue, setPlanRevenue] = useState<PlanRevenue[]>([])
  const [customersByPlan, setCustomersByPlan] = useState<PlanCustomerCount[]>([])
  const [waterfall, setWaterfall] = useState<WaterfallDataPoint[]>([])

  const months =
    dateRange === '30' ? 1 : dateRange === '90' ? 3 : dateRange === '180' ? 6 : 12

  const loadData = useCallback(async () => {
    const supabase = getSupabase()
    try {
      const [summaryData, trendData, revByPlan, custByPlan, waterfallData] =
        await Promise.all([
          fetchRevenueSummary(supabase),
          fetchMrrTrend(supabase, months),
          fetchRevenueByPlan(supabase),
          fetchCustomersByPlan(supabase),
          fetchMrrWaterfall(supabase, Math.min(months, 6)),
        ])
      setSummary(summaryData)
      setMrrTrend(trendData)
      setPlanRevenue(revByPlan)
      setCustomersByPlan(custByPlan)
      setWaterfall(waterfallData)
    } catch (err) {
      console.error('Revenue tab load error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [months])

  useEffect(() => {
    setLoading(true)
    loadData()
  }, [loadData])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const handleExportPdf = () => {
    if (!summary) return
    const doc = new jsPDF({ orientation: 'landscape' })
    const date = new Date().toISOString().slice(0, 10)
    doc.setFontSize(16)
    doc.text('Revenue Dashboard', 14, 15)
    doc.setFontSize(10)
    doc.text(`Generated: ${date} | Last ${dateRange} days`, 14, 22)

    autoTable(doc, {
      startY: 28,
      head: [['Metric', 'Value']],
      body: [
        ['Total MRR', `$${summary.totalMrr.toFixed(2)}`],
        ['Total ARR', `$${summary.totalArr.toFixed(2)}`],
        ['Active Customers', String(summary.activeCount)],
        ['Total Customers', String(summary.totalCustomers)],
        ['Churn Rate', `${summary.churnRate.toFixed(1)}%`],
        ['Churned This Month', String(summary.churnedCount)],
        ['Trial → Paid Rate', `${summary.trialToPaidRate.toFixed(1)}%`],
        ['MRR Change', `$${summary.netRevenueChange.toFixed(2)} (${summary.netRevenueChangePct.toFixed(1)}%)`],
      ],
      headStyles: { fillColor: [30, 64, 175] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
      tableWidth: 130,
    })

    let yPos = (doc as any).lastAutoTable.finalY + 10

    if (mrrTrend.length > 0) {
      doc.setFontSize(12)
      doc.text('MRR Trend', 14, yPos)
      autoTable(doc, {
        startY: yPos + 4,
        head: [['Month', 'MRR', 'Active Subscriptions']],
        body: mrrTrend.map((pt) => [pt.label, `$${pt.mrr.toFixed(2)}`, String(pt.activeSubscriptions)]),
        headStyles: { fillColor: [30, 64, 175] },
      })
      yPos = (doc as any).lastAutoTable.finalY + 10
    }

    if (planRevenue.length > 0) {
      if (yPos > 160) { doc.addPage(); yPos = 14 }
      doc.setFontSize(12)
      doc.text('Revenue by Plan', 14, yPos)
      autoTable(doc, {
        startY: yPos + 4,
        head: [['Plan', 'MRR', 'Customers']],
        body: planRevenue.map((p) => [p.planName, `$${p.mrr.toFixed(2)}`, String(p.customerCount)]),
        headStyles: { fillColor: [30, 64, 175] },
      })
    }

    doc.save(`revenue-dashboard-${date}.pdf`)
  }

  const handleExportCsv = () => {
    if (!summary) return
    const csv = revenueDataToCsv(summary, mrrTrend, planRevenue)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `revenue-dashboard-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-end gap-2">
        <Select
          value={dateRange}
          onValueChange={(v) => setDateRange(v as DateRange)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="180">Last 180 days</SelectItem>
            <SelectItem value="365">Last 365 days</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>

        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!summary}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>

        <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!summary}>
          <FileDown className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {/* KPI Summary Cards */}
      <RevenueSummaryCards
        summary={
          summary ?? {
            totalMrr: 0,
            totalArr: 0,
            netRevenueChange: 0,
            netRevenueChangePct: 0,
            churnRate: 0,
            churnedCount: 0,
            activeCount: 0,
            trialToPaidRate: 0,
            totalCustomers: 0,
          }
        }
        loading={loading}
      />

      {/* MRR Trend Line Chart */}
      <MRRTrendChart data={mrrTrend} loading={loading} />

      {/* Revenue by Plan + Customers by Plan */}
      <RevenueByPlanChart
        revenueData={planRevenue}
        customerData={customersByPlan}
        loading={loading}
      />

      {/* New vs Churned MRR Waterfall */}
      <ChurnWaterfallChart data={waterfall} loading={loading} />
    </div>
  )
}
