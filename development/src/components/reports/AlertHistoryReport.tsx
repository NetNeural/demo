'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format, subDays, subHours } from 'date-fns'
import { 
  CalendarIcon, 
  Download, 
  Filter, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Alert {
  id: string
  title: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  alert_type: string
  device_id?: string
  device_name?: string
  created_at: string
  is_resolved: boolean
  resolved_at?: string
  resolved_by?: string
  metadata?: {
    threshold_id?: string
    current_value?: number
    threshold_value?: number
    breach_type?: string
    [key: string]: unknown
  }
}

interface AlertAcknowledgement {
  id: string
  alert_id: string
  user_id: string
  user_email?: string
  acknowledgement_type: 'acknowledged' | 'resolved' | 'dismissed' | 'false_positive'
  acknowledged_at: string
  notes?: string
}

interface AlertWithAck extends Alert {
  acknowledgement?: AlertAcknowledgement
  responseTimeMinutes?: number
  isFalsePositive?: boolean
}

interface StatsData {
  totalAlerts: number
  criticalAlerts: number
  highAlerts: number
  mediumAlerts: number
  lowAlerts: number
  acknowledgedAlerts: number
  unresolvedAlerts: number
  avgResponseTimeMinutes: number
  falsePositiveCount: number
  falsePositiveRate: number
}

type DateRangePreset = 'today' | '24h' | '7d' | '30d' | 'custom'

export function AlertHistoryReport() {
  const { currentOrganization } = useOrganization()
  const [alerts, setAlerts] = useState<AlertWithAck[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<StatsData>({
    totalAlerts: 0,
    criticalAlerts: 0,
    highAlerts: 0,
    mediumAlerts: 0,
    lowAlerts: 0,
    acknowledgedAlerts: 0,
    unresolvedAlerts: 0,
    avgResponseTimeMinutes: 0,
    falsePositiveCount: 0,
    falsePositiveRate: 0
  })

  // Filters
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('7d')
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 7))
  const [endDate, setEndDate] = useState<Date | undefined>(new Date())
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [deviceFilter, setDeviceFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Device list for filter
  const [devices, setDevices] = useState<Array<{ id: string; name: string }>>([])

  // Fetch devices for filter dropdown
  const fetchDevices = useCallback(async () => {
    if (!currentOrganization) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('devices')
        .select('id, name')
        .eq('organization_id', currentOrganization.id)
        .order('name')

      if (error) {
        console.error('[AlertHistoryReport] Error fetching devices:', error)
        return
      }

      if (data) {
        setDevices(data)
      }
    } catch (error) {
      console.error('[AlertHistoryReport] Error fetching devices:', error)
    }
  }, [currentOrganization])

  // Fetch alerts with acknowledgements
  const fetchAlerts = useCallback(async () => {
    if (!currentOrganization) {
      console.log('[AlertHistoryReport] No organization selected')
      setAlerts([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('[AlertHistoryReport] Fetching alerts for org:', currentOrganization.id)

      const supabase = createClient()

      // Build query - simplified without device join to avoid RLS issues
      let query = supabase
        .from('alerts')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .limit(1000)

      const { data: alertsData, error } = await query
      
      console.log('[AlertHistoryReport] Query result:', { data: alertsData, error, orgId: currentOrganization.id })

      if (error) {
        console.error('[AlertHistoryReport] Database error:', error)
        throw new Error(`Failed to fetch alerts: ${error.message}`)
      }

      console.log('[AlertHistoryReport] Fetched alerts:', alertsData?.length || 0)

      if (!alertsData || alertsData.length === 0) {
        console.warn('[AlertHistoryReport] No alerts found for organization')
        setAlerts([])
        setStats({
          totalAlerts: 0,
          criticalAlerts: 0,
          highAlerts: 0,
          mediumAlerts: 0,
          lowAlerts: 0,
          acknowledgedAlerts: 0,
          unresolvedAlerts: 0,
          avgResponseTimeMinutes: 0,
          falsePositiveCount: 0,
          falsePositiveRate: 0
        })
        setLoading(false)
        return
      }

      // Fetch acknowledgements for all alerts
      // Note: This would need to be implemented in the edge function
      const acknowledgementsMap = new Map<string, AlertAcknowledgement>()
      
      try {
        // For now, we'll calculate stats based on is_resolved flag
        // In a full implementation, you'd fetch from alert_acknowledgements table
      } catch (ackError) {
        console.warn('[AlertHistoryReport] Could not fetch acknowledgements:', ackError)
      }

      // Combine alerts with acknowledgements and calculate response times
      // deno-lint-ignore no-explicit-any
      const alertsWithAck: AlertWithAck[] = alertsData.map((alert: any) => {
        const ack = acknowledgementsMap.get(alert.id)
        let responseTimeMinutes: number | undefined
        let isFalsePositive = false

        if (alert.is_resolved && alert.resolved_at && ack?.acknowledged_at) {
          const createdTime = new Date(alert.created_at).getTime()
          const acknowledgedTime = new Date(ack.acknowledged_at).getTime()
          responseTimeMinutes = (acknowledgedTime - createdTime) / 1000 / 60

          // False positive: acknowledged within 5 minutes
          isFalsePositive = responseTimeMinutes < 5 && ack.acknowledgement_type === 'false_positive'
        }

        return {
          id: alert.id,
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
          alert_type: alert.alert_type,
          device_id: alert.device_id,
          device_name: alert.device_id || 'No Device',
          created_at: alert.created_at,
          is_resolved: alert.is_resolved,
          resolved_at: alert.resolved_at,
          resolved_by: alert.resolved_by,
          metadata: alert.metadata,
          acknowledgement: ack,
          responseTimeMinutes,
          isFalsePositive
        }
      })

      // Apply filters
      let filteredAlerts = alertsWithAck

      // Date range filter
      if (startDate && endDate) {
        filteredAlerts = filteredAlerts.filter(alert => {
          const alertDate = new Date(alert.created_at)
          return alertDate >= startDate && alertDate <= endDate
        })
      }

      // Severity filter
      if (severityFilter !== 'all') {
        filteredAlerts = filteredAlerts.filter(alert => alert.severity === severityFilter)
      }

      // Device filter
      if (deviceFilter !== 'all') {
        filteredAlerts = filteredAlerts.filter(alert => alert.device_id === deviceFilter)
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'resolved') {
          filteredAlerts = filteredAlerts.filter(alert => alert.is_resolved)
        } else if (statusFilter === 'unresolved') {
          filteredAlerts = filteredAlerts.filter(alert => !alert.is_resolved)
        }
      }

      // Calculate statistics
      const totalAlerts = filteredAlerts.length
      const criticalAlerts = filteredAlerts.filter(a => a.severity === 'critical').length
      const highAlerts = filteredAlerts.filter(a => a.severity === 'high').length
      const mediumAlerts = filteredAlerts.filter(a => a.severity === 'medium').length
      const lowAlerts = filteredAlerts.filter(a => a.severity === 'low').length
      const acknowledgedAlerts = filteredAlerts.filter(a => a.is_resolved).length
      const unresolvedAlerts = totalAlerts - acknowledgedAlerts
      const falsePositiveCount = filteredAlerts.filter(a => a.isFalsePositive).length
      const falsePositiveRate = totalAlerts > 0 ? (falsePositiveCount / totalAlerts) * 100 : 0

      const alertsWithResponseTime = filteredAlerts.filter(a => a.responseTimeMinutes !== undefined)
      const avgResponseTimeMinutes = alertsWithResponseTime.length > 0
        ? alertsWithResponseTime.reduce((sum, a) => sum + (a.responseTimeMinutes || 0), 0) / alertsWithResponseTime.length
        : 0

      setStats({
        totalAlerts,
        criticalAlerts,
        highAlerts,
        mediumAlerts,
        lowAlerts,
        acknowledgedAlerts,
        unresolvedAlerts,
        avgResponseTimeMinutes,
        falsePositiveCount,
        falsePositiveRate
      })

      setAlerts(filteredAlerts)
    } catch (error) {
      console.error('[AlertHistoryReport] Error fetching alerts:', error)
      toast.error('Failed to load alert history')
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }, [currentOrganization, startDate, endDate, severityFilter, deviceFilter, statusFilter])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  // Handle date range preset changes
  const handleDateRangePreset = (preset: DateRangePreset) => {
    setDateRangePreset(preset)
    const now = new Date()

    switch (preset) {
      case 'today':
        setStartDate(new Date(now.setHours(0, 0, 0, 0)))
        setEndDate(new Date())
        break
      case '24h':
        setStartDate(subHours(now, 24))
        setEndDate(new Date())
        break
      case '7d':
        setStartDate(subDays(now, 7))
        setEndDate(new Date())
        break
      case '30d':
        setStartDate(subDays(now, 30))
        setEndDate(new Date())
        break
      case 'custom':
        // User will set custom dates
        break
    }
  }

  // Export to CSV
  const handleExport = () => {
    const csv = [
      ['Date', 'Alert Type', 'Severity', 'Device', 'Status', 'Response Time (min)', 'Acknowledged By', 'Title', 'Description'].join(','),
      ...alerts.map(alert => [
        format(new Date(alert.created_at), 'yyyy-MM-dd HH:mm:ss'),
        alert.alert_type,
        alert.severity,
        alert.device_name || 'N/A',
        alert.is_resolved ? 'Resolved' : 'Unresolved',
        alert.responseTimeMinutes ? alert.responseTimeMinutes.toFixed(2) : 'N/A',
        alert.acknowledgement?.user_email || 'N/A',
        `"${alert.title}"`,
        `"${alert.message}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `alert-history-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Report exported successfully')
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'high': return 'default'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'outline'
    }
  }

  if (!currentOrganization) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Please select an organization to view alert history
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Alert History Report</h2>
          <p className="text-muted-foreground">
            Analyze historical alert data and identify patterns
          </p>
        </div>
        <Button onClick={handleExport} disabled={loading || alerts.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAlerts}</div>
            <div className="text-xs text-muted-foreground space-y-1 mt-2">
              <div className="flex justify-between">
                <span>Critical:</span>
                <span className="font-semibold text-red-600">{stats.criticalAlerts}</span>
              </div>
              <div className="flex justify-between">
                <span>High:</span>
                <span className="font-semibold text-orange-600">{stats.highAlerts}</span>
              </div>
              <div className="flex justify-between">
                <span>Medium:</span>
                <span className="font-semibold text-yellow-600">{stats.mediumAlerts}</span>
              </div>
              <div className="flex justify-between">
                <span>Low:</span>
                <span className="font-semibold text-blue-600">{stats.lowAlerts}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgResponseTimeMinutes.toFixed(1)} min
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Time from alert to acknowledgement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalAlerts > 0 ? ((stats.acknowledgedAlerts / stats.totalAlerts) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.acknowledgedAlerts} of {stats.totalAlerts} resolved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">False Positive Rate</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.falsePositiveRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.falsePositiveCount} false positives identified
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {/* Date Range Presets */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Select value={dateRangePreset} onValueChange={(value) => handleDateRangePreset(value as DateRangePreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            {dateRangePreset === 'custom' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !startDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'PPP') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !endDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, 'PPP') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            {/* Severity Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Severity</label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Device Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Device</label>
              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  {devices.map(device => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="unresolved">Unresolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Table */}
      <Card>
        <CardHeader>
          <CardTitle>Alert History</CardTitle>
          <CardDescription>
            {loading ? 'Loading alerts...' : `Showing ${alerts.length} alerts`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No alerts found for the selected filters
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Alert Type</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Response Time</TableHead>
                    <TableHead className="max-w-md">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map(alert => (
                    <TableRow key={alert.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-sm">
                          {format(new Date(alert.created_at), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(alert.created_at), 'HH:mm:ss')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {alert.alert_type}
                      </TableCell>
                      <TableCell>
                        {alert.device_name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {alert.is_resolved ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Resolved
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Unresolved
                          </Badge>
                        )}
                        {alert.isFalsePositive && (
                          <Badge variant="outline" className="ml-1 bg-gray-50">
                            False Positive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {alert.responseTimeMinutes !== undefined ? (
                          <span className={cn(
                            alert.responseTimeMinutes < 5 ? 'text-green-600' :
                            alert.responseTimeMinutes < 30 ? 'text-yellow-600' :
                            'text-red-600'
                          )}>
                            {alert.responseTimeMinutes.toFixed(1)} min
                          </span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="text-sm font-medium">{alert.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {alert.message}
                        </div>
                        {alert.acknowledgement && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Acknowledged by {alert.acknowledgement.user_email}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
