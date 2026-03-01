'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUser } from '@/contexts/UserContext'
import { createClient } from '@/lib/supabase/client'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
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
import {
  ArrowLeft,
  Download,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react'

// Lazy Supabase singleton
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

type DateRange = '30' | '90' | '180' | '365'

export default function RevenueAdminPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RevenuePageContent />
    </Suspense>
  )
}

function RevenuePageContent() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const isSuperAdmin = user?.isSuperAdmin || false

  const [dateRange, setDateRange] = useState<DateRange>('365')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [summary, setSummary] = useState<RevenueSummary | null>(null)
  const [mrrTrend, setMrrTrend] = useState<MrrDataPoint[]>([])
  const [planRevenue, setPlanRevenue] = useState<PlanRevenue[]>([])
  const [customersByPlan, setCustomersByPlan] = useState<PlanCustomerCount[]>([])
  const [waterfall, setWaterfall] = useState<WaterfallDataPoint[]>([])

  const months = dateRange === '30' ? 1 : dateRange === '90' ? 3 : dateRange === '180' ? 6 : 12

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
      console.error('Revenue dashboard load error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [months])

  useEffect(() => {
    if (isSuperAdmin) {
      setLoading(true)
      loadData()
    }
  }, [isSuperAdmin, loadData])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
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

  // Loading
  if (userLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center p-12">
          <div className="space-y-4 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  // Super admin gate
  if (!isSuperAdmin) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Revenue</h2>
          <p className="text-muted-foreground">Platform revenue dashboard</p>
        </div>
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-4 text-center">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">Access Restricted</p>
            <p className="max-w-md text-sm text-muted-foreground">
              The revenue dashboard is available to super admins only. Contact
              the platform administrator if you need access.
            </p>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard')}
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <TrendingUp className="h-7 w-7" />
              Revenue Dashboard
            </h2>
            <p className="text-muted-foreground">
              Platform-wide MRR, ARR, churn, and conversion metrics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* KPI Summary Cards */}
      <RevenueSummaryCards
        summary={summary ?? {
          totalMrr: 0, totalArr: 0, netRevenueChange: 0, netRevenueChangePct: 0,
          churnRate: 0, churnedCount: 0, activeCount: 0, trialToPaidRate: 0, totalCustomers: 0,
        }}
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
