'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  RefreshCw,
  Search,
  Inbox,
  CreditCard,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Download,
  ExternalLink,
} from 'lucide-react'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import type { SubscriptionStatus } from '@/types/billing'
import { formatSubscriptionStatus, isSubscriptionActive, formatPlanPrice } from '@/types/billing'

let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

interface SubscriptionRow {
  id: string
  organization_id: string
  organization_name: string
  plan_name: string
  plan_slug: string
  price_per_device: number
  price_monthly: number
  pricing_model: string
  status: SubscriptionStatus
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  device_count: number
  mrr: number
}

interface SummaryStats {
  total: number
  active: number
  trialing: number
  pastDue: number
  canceled: number
  totalMrr: number
}

const STATUS_ICONS: Record<SubscriptionStatus, React.ReactNode> = {
  active: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  trialing: <Clock className="h-3.5 w-3.5 text-blue-500" />,
  past_due: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
  canceled: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  incomplete: <Clock className="h-3.5 w-3.5 text-gray-500" />,
}

const STATUS_BADGE_COLORS: Record<SubscriptionStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  past_due: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  canceled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  incomplete: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

export function SubscriptionsTab() {
  const router = useRouter()
  const { fmt } = useDateFormatter()
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([])
  const [summary, setSummary] = useState<SummaryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const loadData = useCallback(async () => {
    const supabase = getSupabase()
    try {
      // Fetch subscriptions with plan and org info
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: subData, error } = await (supabase as any)
        .from('subscriptions')
        .select(`
          id,
          organization_id,
          status,
          stripe_subscription_id,
          stripe_customer_id,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          created_at,
          plan:plan_id (name, slug, price_per_device, price_monthly, pricing_model)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Subscriptions fetch error:', error)
        return
      }

      // Fetch org names
      const orgIds = [...new Set((subData || []).map((s: any) => s.organization_id))] as string[]
      let orgMap: Record<string, string> = {}
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds)
        if (orgs) {
          orgMap = Object.fromEntries(orgs.map((o: any) => [o.id, o.name]))
        }
      }

      // Fetch device counts per org
      const { data: deviceCounts } = await supabase
        .from('devices')
        .select('organization_id')
        .is('deleted_at', null)
      
      const deviceCountMap: Record<string, number> = {}
      if (deviceCounts) {
        for (const d of deviceCounts) {
          const orgId = (d as any).organization_id
          deviceCountMap[orgId] = (deviceCountMap[orgId] || 0) + 1
        }
      }

      const rows: SubscriptionRow[] = (subData || []).map((s: any) => {
        const deviceCount = deviceCountMap[s.organization_id] || 0
        const plan = s.plan || {}
        let mrr = 0
        if (plan.pricing_model === 'per_device') {
          mrr = deviceCount * (plan.price_per_device || 0)
        } else {
          mrr = plan.price_monthly || 0
        }
        return {
          id: s.id,
          organization_id: s.organization_id,
          organization_name: orgMap[s.organization_id] || 'Unknown',
          plan_name: plan.name || 'Unknown',
          plan_slug: plan.slug || '',
          price_per_device: plan.price_per_device || 0,
          price_monthly: plan.price_monthly || 0,
          pricing_model: plan.pricing_model || 'flat',
          status: s.status,
          stripe_subscription_id: s.stripe_subscription_id,
          stripe_customer_id: s.stripe_customer_id,
          current_period_start: s.current_period_start,
          current_period_end: s.current_period_end,
          cancel_at_period_end: s.cancel_at_period_end,
          created_at: s.created_at,
          device_count: deviceCount,
          mrr: isSubscriptionActive(s.status) ? mrr : 0,
        }
      })

      setSubscriptions(rows)

      // Compute summary
      const stats: SummaryStats = {
        total: rows.length,
        active: rows.filter((r) => r.status === 'active').length,
        trialing: rows.filter((r) => r.status === 'trialing').length,
        pastDue: rows.filter((r) => r.status === 'past_due').length,
        canceled: rows.filter((r) => r.status === 'canceled').length,
        totalMrr: rows.reduce((sum, r) => sum + r.mrr, 0),
      }
      setSummary(stats)
    } catch (err) {
      console.error('Subscriptions load error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const handleExportCsv = () => {
    const headers = ['Organization', 'Plan', 'Status', 'MRR', 'Devices', 'Period Start', 'Period End', 'Stripe ID', 'Created']
    const csvRows = filteredSubscriptions.map((s) => [
      s.organization_name,
      s.plan_name,
      s.status,
      `$${(s.mrr / 100).toFixed(2)}`,
      s.device_count,
      s.current_period_start ? new Date(s.current_period_start).toISOString().split('T')[0] : '',
      s.current_period_end ? new Date(s.current_period_end).toISOString().split('T')[0] : '',
      s.stripe_subscription_id || '',
      new Date(s.created_at).toISOString().split('T')[0],
    ])
    const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `subscriptions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filter
  const filteredSubscriptions = subscriptions.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        s.organization_name.toLowerCase().includes(q) ||
        s.plan_name.toLowerCase().includes(q) ||
        (s.stripe_subscription_id || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{summary.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trialing</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{summary.trialing}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Past Due</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{summary.pastDue}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly MRR</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(summary.totalMrr / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orgs, plans..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trialing">Trialing</SelectItem>
              <SelectItem value="past_due">Past Due</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
              <SelectItem value="incomplete">Incomplete</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={filteredSubscriptions.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      {filteredSubscriptions.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-2 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No subscriptions found</p>
            <p className="text-xs text-muted-foreground">
              {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Subscriptions will appear here once organizations subscribe to plans'}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Devices</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead>Period End</TableHead>
                <TableHead>Stripe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">
                    <button
                      className="text-left hover:underline"
                      onClick={() => router.push(`/dashboard/admin/customers/${sub.organization_id}`)}
                    >
                      {sub.organization_name}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{sub.plan_name}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`gap-1 ${STATUS_BADGE_COLORS[sub.status]}`}>
                      {STATUS_ICONS[sub.status]}
                      {formatSubscriptionStatus(sub.status)}
                    </Badge>
                    {sub.cancel_at_period_end && (
                      <Badge variant="outline" className="ml-1 text-[10px]">Cancels</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{sub.device_count}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${(sub.mrr / 100).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {sub.current_period_end ? fmt.shortDate(new Date(sub.current_period_end)) : '—'}
                  </TableCell>
                  <TableCell>
                    {sub.stripe_subscription_id ? (
                      <a
                        href={`https://dashboard.stripe.com/subscriptions/${sub.stripe_subscription_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
