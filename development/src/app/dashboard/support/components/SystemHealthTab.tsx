'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Activity,
  Database,
  Clock,
  HardDrive,
  AlertTriangle,
  RefreshCw,
  Wifi,
  TrendingUp,
  BarChart3,
  Shield,
} from 'lucide-react'
import { formatDistanceToNow, format, subDays, subHours } from 'date-fns'

interface Props {
  organizationId: string
  isSuperAdmin: boolean
}

interface TableStat {
  table_name: string
  row_count: number
  total_size: string
  total_bytes: number
}

interface EdgeMetrics {
  totalInvocations: number
  avgResponseTime: number
  successRate: number
  errorRate: number
  byType: Record<string, { total: number; success: number; failed: number; avgMs: number }>
  hourlyTrend: { hour: string; count: number; avgMs: number; errors: number }[]
  slowest: { activity_type: string; response_time_ms: number; created_at: string; status: string }[]
}

interface StorageMetrics {
  telemetryCount: number
  alertCount: number
  auditLogCount: number
  orgTelemetryCounts?: { org_name: string; count: number }[]
}

interface ErrorMetric {
  category: string
  count: number
  percentage: number
}

export default function SystemHealthTab({ organizationId, isSuperAdmin }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState<string>('off')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Metrics state
  const [edgeMetrics, setEdgeMetrics] = useState<EdgeMetrics | null>(null)
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics | null>(null)
  const [errorMetrics, setErrorMetrics] = useState<ErrorMetric[]>([])
  const [connectionCount, setConnectionCount] = useState<number | null>(null)

  const fetchEdgeMetrics = useCallback(async () => {
    try {
      const twentyFourHoursAgo = subHours(new Date(), 24).toISOString()
      
      let query = supabase
        .from('integration_activity_log')
        .select('activity_type, status, response_time_ms, created_at, error_message')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })

      if (!isSuperAdmin) {
        query = query.eq('organization_id', organizationId)
      }

      const { data, error } = await query
      if (error) throw error

      const entries = data || []
      const total = entries.length
      const successes = entries.filter(e => e.status === 'success').length
      const failures = total - successes
      const responseTimes = entries.filter(e => e.response_time_ms != null).map(e => e.response_time_ms!)
      const avgMs = responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0

      // Group by type
      const byType: EdgeMetrics['byType'] = {}
      for (const entry of entries) {
        const key = entry.activity_type || 'unknown'
        if (!byType[key]) byType[key] = { total: 0, success: 0, failed: 0, avgMs: 0 }
        byType[key].total++
        if (entry.status === 'success') byType[key].success++
        else byType[key].failed++
      }
      for (const key of Object.keys(byType)) {
        const typeEntries = entries.filter(e => e.activity_type === key && e.response_time_ms != null)
        byType[key]!.avgMs = typeEntries.length > 0
          ? Math.round(typeEntries.map(e => e.response_time_ms!).reduce((a, b) => a + b, 0) / typeEntries.length)
          : 0
      }

      // Hourly trend
      const hourlyMap = new Map<string, { count: number; totalMs: number; errors: number }>()
      for (const entry of entries) {
        const hour = format(new Date(entry.created_at), 'HH:00')
        const existing = hourlyMap.get(hour) || { count: 0, totalMs: 0, errors: 0 }
        existing.count++
        existing.totalMs += entry.response_time_ms || 0
        if (entry.status !== 'success') existing.errors++
        hourlyMap.set(hour, existing)
      }
      const hourlyTrend = Array.from(hourlyMap.entries())
        .map(([hour, stats]) => ({
          hour,
          count: stats.count,
          avgMs: stats.count > 0 ? Math.round(stats.totalMs / stats.count) : 0,
          errors: stats.errors,
        }))
        .sort((a, b) => a.hour.localeCompare(b.hour))

      // Top 5 slowest
      const slowest = entries
        .filter(e => e.response_time_ms != null)
        .sort((a, b) => (b.response_time_ms || 0) - (a.response_time_ms || 0))
        .slice(0, 5)
        .map(e => ({
          activity_type: e.activity_type,
          response_time_ms: e.response_time_ms!,
          created_at: e.created_at,
          status: e.status,
        }))

      setEdgeMetrics({
        totalInvocations: total,
        avgResponseTime: avgMs,
        successRate: total > 0 ? Math.round((successes / total) * 100) : 100,
        errorRate: total > 0 ? Math.round((failures / total) * 100) : 0,
        byType,
        hourlyTrend,
        slowest,
      })
    } catch (err) {
      console.error('Failed to fetch edge metrics:', err)
    }
  }, [organizationId, isSuperAdmin, supabase])

  const fetchStorageMetrics = useCallback(async () => {
    try {
      // Telemetry count
      const telemetryQuery = isSuperAdmin
        ? supabase.from('device_telemetry_history').select('id', { count: 'exact', head: true })
        : supabase.from('device_telemetry_history').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
      const { count: telemetryCount } = await telemetryQuery

      // Alert count
      const alertQuery = isSuperAdmin
        ? supabase.from('alerts').select('id', { count: 'exact', head: true })
        : supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
      const { count: alertCount } = await alertQuery

      // Audit log count
      const auditQuery = isSuperAdmin
        ? supabase.from('user_audit_log').select('id', { count: 'exact', head: true })
        : supabase.from('user_audit_log').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
      const { count: auditLogCount } = await auditQuery

      setStorageMetrics({
        telemetryCount: telemetryCount || 0,
        alertCount: alertCount || 0,
        auditLogCount: auditLogCount || 0,
      })
    } catch (err) {
      console.error('Failed to fetch storage metrics:', err)
    }
  }, [organizationId, isSuperAdmin, supabase])

  const fetchErrorMetrics = useCallback(async () => {
    try {
      const twentyFourHoursAgo = subHours(new Date(), 24).toISOString()

      // Edge function errors
      let efQuery = supabase
        .from('integration_activity_log')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'success')
        .gte('created_at', twentyFourHoursAgo)
      if (!isSuperAdmin) efQuery = efQuery.eq('organization_id', organizationId)
      const { count: efErrors } = await efQuery

      let efTotalQuery = supabase
        .from('integration_activity_log')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo)
      if (!isSuperAdmin) efTotalQuery = efTotalQuery.eq('organization_id', organizationId)
      const { count: efTotal } = await efTotalQuery

      // Alert fires (last 24h)
      let alertQuery = supabase
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo)
      if (!isSuperAdmin) alertQuery = alertQuery.eq('organization_id', organizationId)
      const { count: alertFires } = await alertQuery

      const metrics: ErrorMetric[] = [
        {
          category: 'Edge Function Errors',
          count: efErrors || 0,
          percentage: (efTotal || 0) > 0 ? Math.round(((efErrors || 0) / (efTotal || 1)) * 100) : 0,
        },
        {
          category: 'Alert Fires',
          count: alertFires || 0,
          percentage: 0, // not a rate
        },
      ]

      setErrorMetrics(metrics)
    } catch (err) {
      console.error('Failed to fetch error metrics:', err)
    }
  }, [organizationId, isSuperAdmin, supabase])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchEdgeMetrics(), fetchStorageMetrics(), fetchErrorMetrics()])
    setLastRefresh(new Date())
    setLoading(false)
  }, [fetchEdgeMetrics, fetchStorageMetrics, fetchErrorMetrics])

  useEffect(() => { refreshAll() }, [refreshAll])

  // Auto-refresh
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (autoRefresh !== 'off') {
      const ms = parseInt(autoRefresh) * 1000
      intervalRef.current = setInterval(refreshAll, ms)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh, refreshAll])

  const getHealthColor = (errorRate: number): string => {
    if (errorRate < 1) return 'text-green-600'
    if (errorRate < 5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getHealthBadge = (errorRate: number): { label: string; variant: 'default' | 'secondary' | 'destructive' } => {
    if (errorRate < 1) return { label: 'Healthy', variant: 'default' }
    if (errorRate < 5) return { label: 'Warning', variant: 'secondary' }
    return { label: 'Critical', variant: 'destructive' }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Refresh Controls */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Last refreshed: {formatDistanceToNow(lastRefresh, { addSuffix: true })}
        </p>
        <div className="flex items-center gap-2">
          <Select value={autoRefresh} onValueChange={setAutoRefresh}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Auto-refresh: Off</SelectItem>
              <SelectItem value="30">Every 30s</SelectItem>
              <SelectItem value="60">Every 1m</SelectItem>
              <SelectItem value="300">Every 5m</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh Now
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{edgeMetrics?.totalInvocations ?? 0}</p>
                <p className="text-sm text-muted-foreground">Invocations (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{edgeMetrics?.avgResponseTime ?? 0}ms</p>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{edgeMetrics?.successRate ?? 100}%</p>
                <p className="text-sm text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-8 h-8 ${getHealthColor(edgeMetrics?.errorRate ?? 0)}`} />
              <div>
                <p className="text-2xl font-bold">{edgeMetrics?.errorRate ?? 0}%</p>
                <p className="text-sm text-muted-foreground">Error Rate</p>
                <Badge variant={getHealthBadge(edgeMetrics?.errorRate ?? 0).variant} className="text-xs mt-1">
                  {getHealthBadge(edgeMetrics?.errorRate ?? 0).label}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edge Function Metrics by Type */}
      {edgeMetrics && Object.keys(edgeMetrics.byType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Edge Function Breakdown by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(edgeMetrics.byType)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([type, stats]) => {
                  const successPct = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 100
                  return (
                    <div key={type} className="flex items-center gap-4">
                      <div className="w-40 text-sm font-medium truncate">{type.replace(/_/g, ' ')}</div>
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${successPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-[200px] justify-end">
                        <span>{stats.total} calls</span>
                        <span className="text-green-600">{stats.success} ok</span>
                        {stats.failed > 0 && <span className="text-red-600">{stats.failed} failed</span>}
                        <span>{stats.avgMs}ms avg</span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hourly Activity Trend (text-based) */}
      {edgeMetrics && edgeMetrics.hourlyTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Hourly Activity Trend (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {edgeMetrics.hourlyTrend.map(h => (
                <div key={h.hour} className="border rounded p-2 text-center">
                  <p className="text-xs font-mono font-medium">{h.hour}</p>
                  <p className="text-lg font-bold">{h.count}</p>
                  <p className="text-[10px] text-muted-foreground">{h.avgMs}ms avg</p>
                  {h.errors > 0 && <p className="text-[10px] text-red-600">{h.errors} errors</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 5 Slowest Invocations */}
      {edgeMetrics && edgeMetrics.slowest.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Slowest Invocations (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {edgeMetrics.slowest.map((entry, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-foreground">#{i + 1}</span>
                    <Badge variant="outline" className="text-xs">{entry.activity_type.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={entry.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                      {entry.status}
                    </Badge>
                    <span className="font-mono font-bold text-sm">{entry.response_time_ms}ms</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Storage Usage */}
      {storageMetrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Storage Usage {!isSuperAdmin && '(This Organization)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold">{storageMetrics.telemetryCount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Telemetry Records</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold">{storageMetrics.alertCount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Alert Records</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold">{storageMetrics.auditLogCount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Audit Log Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Rates */}
      {errorMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Error Summary (Last 24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {errorMetrics.map((metric) => (
                <div key={metric.category} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium text-sm">{metric.category}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">{metric.count}</span>
                    {metric.percentage > 0 && (
                      <Badge variant={getHealthBadge(metric.percentage).variant} className="text-xs">
                        {metric.percentage}% rate
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
