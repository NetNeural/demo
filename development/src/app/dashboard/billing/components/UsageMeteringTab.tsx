'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { Progress } from '@/components/ui/progress'
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
  Download,
  Cpu,
  Users,
  Zap,
  HardDrive,
  Cloud,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
} from 'lucide-react'
import type { UsageMetricType } from '@/types/billing'
import { formatStorageBytes, formatLimit } from '@/types/billing'

let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

const METRIC_ICONS: Record<UsageMetricType, React.ReactNode> = {
  device_count: <Cpu className="h-4 w-4" />,
  user_count: <Users className="h-4 w-4" />,
  api_calls: <Zap className="h-4 w-4" />,
  storage_bytes: <HardDrive className="h-4 w-4" />,
  edge_function_invocations: <Cloud className="h-4 w-4" />,
}

const METRIC_LABELS: Record<UsageMetricType, string> = {
  device_count: 'Devices',
  user_count: 'Users',
  api_calls: 'API Calls',
  storage_bytes: 'Storage',
  edge_function_invocations: 'Edge Functions',
}

interface OrgUsageRow {
  organization_id: string
  organization_name: string
  plan_name: string
  metrics: {
    metric_type: UsageMetricType
    current_value: number
    plan_limit: number
    usage_percent: number
    is_warning: boolean
    is_exceeded: boolean
    is_unlimited: boolean
  }[]
}

interface PlatformSummary {
  totalOrgs: number
  totalDevices: number
  totalUsers: number
  orgsAtWarning: number
  orgsExceeded: number
}

export function UsageMeteringTab() {
  const [orgUsage, setOrgUsage] = useState<OrgUsageRow[]>([])
  const [summary, setSummary] = useState<PlatformSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMetric, setFilterMetric] = useState<string>('all')

  const loadData = useCallback(async () => {
    const supabase = getSupabase()
    try {
      // Fetch all usage metrics
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: usageData, error } = await (supabase as any)
        .from('usage_metrics')
        .select('organization_id, metric_type, current_value, period_start')
        .eq('period_start', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        .order('organization_id')

      if (error) {
        console.error('Usage metrics fetch error:', error)
        return
      }

      // Fetch org names
      const orgIds = [...new Set((usageData || []).map((u: any) => u.organization_id))] as string[]
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

      // Fetch subscription plan info per org
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: subData } = await (supabase as any)
        .from('subscriptions')
        .select('organization_id, plan:plan_id (name, max_devices, max_users)')
        .in('status', ['active', 'trialing'])

      const planMap: Record<string, { name: string; max_devices: number; max_users: number }> = {}
      if (subData) {
        for (const s of subData) {
          if (s.plan) {
            planMap[s.organization_id] = {
              name: s.plan.name,
              max_devices: s.plan.max_devices,
              max_users: s.plan.max_users,
            }
          }
        }
      }

      // Group by org
      const orgGroups: Record<string, OrgUsageRow> = {}
      for (const row of (usageData || [])) {
        const orgId = row.organization_id
        if (!orgGroups[orgId]) {
          const plan = planMap[orgId] || { name: 'No Plan', max_devices: 5, max_users: 3 }
          orgGroups[orgId] = {
            organization_id: orgId,
            organization_name: orgMap[orgId] || 'Unknown',
            plan_name: plan.name,
            metrics: [],
          }
        }
        const plan = planMap[orgId] || { name: 'No Plan', max_devices: 5, max_users: 3 }
        let planLimit = -1
        if (row.metric_type === 'device_count') planLimit = plan.max_devices
        else if (row.metric_type === 'user_count') planLimit = plan.max_users

        const isUnlimited = planLimit === -1
        const usagePercent = isUnlimited || planLimit === 0 ? 0 : Math.round((row.current_value / planLimit) * 100)

        orgGroups[orgId].metrics.push({
          metric_type: row.metric_type,
          current_value: row.current_value,
          plan_limit: planLimit,
          usage_percent: usagePercent,
          is_warning: !isUnlimited && usagePercent >= 80,
          is_exceeded: !isUnlimited && usagePercent >= 100,
          is_unlimited: isUnlimited,
        })
      }

      const rows = Object.values(orgGroups)
      setOrgUsage(rows)

      // Compute summary
      let totalDevices = 0
      let totalUsers = 0
      let orgsAtWarning = 0
      let orgsExceeded = 0
      for (const org of rows) {
        for (const m of org.metrics) {
          if (m.metric_type === 'device_count') totalDevices += m.current_value
          if (m.metric_type === 'user_count') totalUsers += m.current_value
          if (m.is_exceeded) orgsExceeded++
          else if (m.is_warning) orgsAtWarning++
        }
      }
      setSummary({
        totalOrgs: rows.length,
        totalDevices,
        totalUsers,
        orgsAtWarning,
        orgsExceeded,
      })
    } catch (err) {
      console.error('Usage metering load error:', err)
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
    const headers = ['Organization', 'Plan', 'Metric', 'Current', 'Limit', 'Usage %', 'Status']
    const csvRows: string[][] = []
    for (const org of filteredOrgs) {
      for (const m of org.metrics) {
        csvRows.push([
          org.organization_name,
          org.plan_name,
          METRIC_LABELS[m.metric_type],
          String(m.current_value),
          m.is_unlimited ? 'Unlimited' : String(m.plan_limit),
          `${m.usage_percent}%`,
          m.is_exceeded ? 'Exceeded' : m.is_warning ? 'Warning' : 'OK',
        ])
      }
    }
    const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `usage-metering-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filter
  const filteredOrgs = orgUsage.filter((org) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!org.organization_name.toLowerCase().includes(q) && !org.plan_name.toLowerCase().includes(q)) {
        return false
      }
    }
    if (filterMetric === 'warning') {
      return org.metrics.some((m) => m.is_warning && !m.is_exceeded)
    }
    if (filterMetric === 'exceeded') {
      return org.metrics.some((m) => m.is_exceeded)
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
              <CardTitle className="text-sm font-medium">Organizations</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalOrgs}</div>
              <p className="text-xs text-muted-foreground">with active metrics</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalDevices}</div>
              <p className="text-xs text-muted-foreground">across all orgs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalUsers}</div>
              <p className="text-xs text-muted-foreground">across all orgs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">At Warning</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{summary.orgsAtWarning}</div>
              <p className="text-xs text-muted-foreground">&ge; 80% usage</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Exceeded</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.orgsExceeded}</div>
              <p className="text-xs text-muted-foreground">&ge; 100% usage</p>
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
              placeholder="Search organizations..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={filterMetric} onValueChange={setFilterMetric}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All orgs</SelectItem>
              <SelectItem value="warning">At warning</SelectItem>
              <SelectItem value="exceeded">Exceeded</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={filteredOrgs.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      {filteredOrgs.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-2 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No usage data found</p>
            <p className="text-xs text-muted-foreground">
              {searchQuery || filterMetric !== 'all' ? 'Try adjusting your filters' : 'Usage metrics will populate once organizations have active subscriptions'}
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
                <TableHead>Devices</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>API Calls</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrgs.map((org) => {
                const deviceMetric = org.metrics.find((m) => m.metric_type === 'device_count')
                const userMetric = org.metrics.find((m) => m.metric_type === 'user_count')
                const apiMetric = org.metrics.find((m) => m.metric_type === 'api_calls')
                const hasWarning = org.metrics.some((m) => m.is_warning && !m.is_exceeded)
                const hasExceeded = org.metrics.some((m) => m.is_exceeded)

                return (
                  <TableRow key={org.organization_id}>
                    <TableCell className="font-medium">{org.organization_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{org.plan_name}</Badge>
                    </TableCell>
                    <TableCell>
                      {deviceMetric ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            {METRIC_ICONS.device_count}
                            <span>{deviceMetric.current_value}</span>
                            <span className="text-muted-foreground">
                              / {deviceMetric.is_unlimited ? '∞' : deviceMetric.plan_limit}
                            </span>
                          </div>
                          {!deviceMetric.is_unlimited && (
                            <Progress
                              value={Math.min(deviceMetric.usage_percent, 100)}
                              className={`h-1.5 ${deviceMetric.is_exceeded ? '[&>div]:bg-red-500' : deviceMetric.is_warning ? '[&>div]:bg-amber-500' : ''}`}
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {userMetric ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            {METRIC_ICONS.user_count}
                            <span>{userMetric.current_value}</span>
                            <span className="text-muted-foreground">
                              / {userMetric.is_unlimited ? '∞' : userMetric.plan_limit}
                            </span>
                          </div>
                          {!userMetric.is_unlimited && (
                            <Progress
                              value={Math.min(userMetric.usage_percent, 100)}
                              className={`h-1.5 ${userMetric.is_exceeded ? '[&>div]:bg-red-500' : userMetric.is_warning ? '[&>div]:bg-amber-500' : ''}`}
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {apiMetric ? (
                        <div className="flex items-center gap-1 text-sm">
                          {METRIC_ICONS.api_calls}
                          <span>{apiMetric.current_value.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasExceeded ? (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Exceeded
                        </Badge>
                      ) : hasWarning ? (
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Warning
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          OK
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
