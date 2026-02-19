'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { toast } from 'sonner'
import {
  Search,
  Wifi,
  WifiOff,
  Activity,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  Wrench,
} from 'lucide-react'
import { format, subHours } from 'date-fns'
import { useDateFormatter } from '@/hooks/useDateFormatter'

interface Device {
  id: string
  name: string
  serial_number: string | null
  status: string | null
  last_seen: string | null
  metadata: unknown
  organization_id: string
}

interface Integration {
  id: string
  name: string
  integration_type: string
  status: string
  last_test_at?: string | null
  last_test_status?: string | null
  organization_id: string
}

interface ActivityLogEntry {
  id: string
  activity_type: string
  direction: string
  status: string
  response_time_ms?: number | null
  device_count?: number | null
  error_message?: string | null
  created_at: string
  request_body?: Record<string, unknown> | null
  response_body?: Record<string, unknown> | null
}

interface TelemetryEntry {
  telemetry: unknown
  received_at: string
  device_timestamp?: string | null
}

interface AlertEntry {
  id: string
  severity: string
  message: string
  is_resolved: boolean
  created_at: string
}

interface Props {
  organizationId: string
}

export default function TroubleshootingTab({ organizationId }: Props) {
  const supabase = createClient()
  const { fmt } = useDateFormatter()

  // Device diagnostics state
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [deviceSearch, setDeviceSearch] = useState('')
  const [lastTelemetry, setLastTelemetry] = useState<TelemetryEntry | null>(null)
  const [deviceAlerts, setDeviceAlerts] = useState<AlertEntry[]>([])
  const [diagLoading, setDiagLoading] = useState(false)

  // Integration testing state
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; durationMs?: number }>>({})

  // Edge function logs state
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all')
  const [logStatusFilter, setLogStatusFilter] = useState<string>('all')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const [logsPage, setLogsPage] = useState(0)
  const LOGS_PAGE_SIZE = 25

  // Define all 8 integration types for testing
  const INTEGRATION_TYPES = [
    { id: 'golioth', label: '🌐 Golioth', name: 'Golioth Integration' },
    { id: 'aws_iot', label: '☁️ AWS IoT Core', name: 'AWS IoT Core Integration' },
    { id: 'azure_iot', label: '🔵 Azure IoT Hub', name: 'Azure IoT Hub Integration' },
    { id: 'mqtt', label: '📡 MQTT Broker', name: 'MQTT Broker Integration' },
    { id: 'email', label: '📧 Email/SMTP', name: 'Email/SMTP Integration' },
    { id: 'slack', label: '💬 Slack', name: 'Slack Integration' },
    { id: 'webhook', label: '🔗 Webhook', name: 'Webhook Integration' },
    { id: 'netneural_hub', label: '🚀 NetNeural Hub', name: 'NetNeural Hub Integration' }
  ]

  // Fetch devices
  const fetchDevices = useCallback(async () => {
    if (!organizationId) return
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('id, name, serial_number, status, last_seen, metadata, organization_id')
        .eq('organization_id', organizationId)
        .order('name')

      if (error) throw error
      setDevices(data || [])
    } catch (err) {
      console.error('Failed to fetch devices:', err)
    }
  }, [organizationId, supabase])

  // Fetch activity logs
  const fetchActivityLogs = useCallback(async () => {
    if (!organizationId) return
    setLogsLoading(true)
    try {
      let query = supabase
        .from('integration_activity_log')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('created_at', subHours(new Date(), 24).toISOString())
        .order('created_at', { ascending: false })

      if (logTypeFilter !== 'all') {
        query = query.eq('activity_type', logTypeFilter)
      }
      if (logStatusFilter !== 'all') {
        query = query.eq('status', logStatusFilter)
      }

      const from = logsPage * LOGS_PAGE_SIZE
      const to = from + LOGS_PAGE_SIZE - 1
      query = query.range(from, to)

      const { data, error } = await query
      if (error) throw error
      setActivityLogs((data as unknown as ActivityLogEntry[]) || [])
    } catch (err) {
      console.error('Failed to fetch activity logs:', err)
      toast.error('Failed to load activity logs')
    } finally {
      setLogsLoading(false)
    }
  }, [organizationId, supabase, logTypeFilter, logStatusFilter, logsPage])

  useEffect(() => { fetchDevices() }, [fetchDevices])
  useEffect(() => { fetchActivityLogs() }, [fetchActivityLogs])

  // Fetch device diagnostics
  const fetchDiagnostics = useCallback(async (deviceId: string) => {
    setDiagLoading(true)
    setLastTelemetry(null)
    setDeviceAlerts([])
    try {
      // Fetch last telemetry
      const { data: telemetry } = await supabase
        .from('device_telemetry_history')
        .select('telemetry, received_at, device_timestamp')
        .eq('device_id', deviceId)
        .order('received_at', { ascending: false })
        .limit(1)
        .single()

      if (telemetry) setLastTelemetry(telemetry as unknown as TelemetryEntry)

      // Fetch recent alerts
      const { data: alerts } = await supabase
        .from('alerts')
        .select('id, severity, message, is_resolved, created_at')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(10)

      setDeviceAlerts((alerts as unknown as AlertEntry[]) || [])
    } catch (err) {
      console.error('Failed to fetch diagnostics:', err)
    } finally {
      setDiagLoading(false)
    }
  }, [supabase])

  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId)
    if (deviceId) fetchDiagnostics(deviceId)
  }

  // Test integration by type
  const handleTestIntegrationType = async (integrationType: string) => {
    setTestingId(integrationType)
    const start = Date.now()
    
    try {
      // Find active integration of this type
      const { data: integration, error: listError } = await supabase
        .from('device_integrations')
        .select('id, name, integration_type, status')
        .eq('organization_id', organizationId)
        .eq('integration_type', integrationType)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (listError || !integration) {
        const durationMs = Date.now() - start
        const integrationName = INTEGRATION_TYPES.find(t => t.id === integrationType)?.name || integrationType
        setTestResults(prev => ({
          ...prev,
          [integrationType]: {
            success: false,
            message: `No active ${integrationName.replace(' Integration', '')} integration found. Configure one in Organizations → Integrations.`,
            durationMs
          }
        }))
        return
      }

      // Call edge function to test the integration
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        const durationMs = Date.now() - start
        setTestResults(prev => ({
          ...prev,
          [integrationType]: { success: false, message: 'No active session', durationMs }
        }))
        return
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/integrations/test?id=${integration.id}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      const result = await response.json()
      const durationMs = Date.now() - start

      if (!response.ok || !result.success) {
        setTestResults(prev => ({
          ...prev,
          [integrationType]: {
            success: false,
            message: result.error?.message || result.message || 'Test failed',
            durationMs
          }
        }))
        toast.error(`${integration.name}: ${result.error?.message || result.message || 'Test failed'}`)
      } else {
        setTestResults(prev => ({
          ...prev,
          [integrationType]: {
            success: true,
            message: `${integration.name}: ${result.message || 'Connection successful'}`,
            durationMs
          }
        }))
        toast.success(`${integration.name}: Test passed`)
      }
    } catch (err) {
      const durationMs = Date.now() - start
      const message = err instanceof Error ? err.message : 'Test failed'
      setTestResults(prev => ({
        ...prev,
        [integrationType]: { success: false, message, durationMs }
      }))
      toast.error(message)
    } finally {
      setTestingId(null)
    }
  }

  // Test all integrations
  const handleTestAll = async () => {
    setTestingId('all')
    for (const integrationType of INTEGRATION_TYPES) {
      await handleTestIntegrationType(integrationType.id)
    }
    setTestingId(null)
    
    const results = Object.values(testResults)
    const passed = results.filter(r => r.success).length
    toast.success(`Integration tests complete: ${passed}/${INTEGRATION_TYPES.length} passed`)
  }

  const copyDiagnostics = () => {
    const device = devices.find(d => d.id === selectedDeviceId)
    const summary = [
      `Device: ${device?.name || 'Unknown'} (${device?.serial_number || 'N/A'})`,
      `Status: ${device?.status || 'Unknown'}`,
      `Last Seen: ${device?.last_seen ? fmt.dateTime(device.last_seen) : 'Never'}`,
      `Last Telemetry: ${lastTelemetry ? fmt.dateTime(lastTelemetry.received_at) : 'None'}`,
      `Recent Alerts: ${deviceAlerts.length}`,
      lastTelemetry ? `Telemetry Data: ${JSON.stringify(lastTelemetry.telemetry, null, 2)}` : '',
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(summary)
    toast.success('Diagnostic summary copied to clipboard')
  }

  const selectedDevice = devices.find(d => d.id === selectedDeviceId)
  const filteredDevices = devices.filter(d =>
    !deviceSearch || d.name.toLowerCase().includes(deviceSearch.toLowerCase()) ||
    d.serial_number?.toLowerCase().includes(deviceSearch.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* ── Device Diagnostics ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Device Diagnostics
          </CardTitle>
          <CardDescription>Select a device to view its full health picture</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Device selector */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search devices..."
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedDeviceId} onValueChange={handleSelectDevice}>
              <SelectTrigger className="w-full sm:w-[300px]">
                <SelectValue placeholder="Select a device..." />
              </SelectTrigger>
              <SelectContent>
                {filteredDevices.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} {d.serial_number ? `(${d.serial_number})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Diagnostic Card */}
          {selectedDevice && (
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{selectedDevice.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground font-mono">
                      ID: {selectedDevice.id}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedDevice.id)
                        toast.success('Device ID copied to clipboard')
                      }}
                      title="Copy Device ID"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    {selectedDevice.serial_number && (
                      <>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          SN: {selectedDevice.serial_number}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fetchDiagnostics(selectedDeviceId)}>
                    <RefreshCw className="w-4 h-4 mr-1" /> Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={copyDiagnostics}>
                    <Copy className="w-4 h-4 mr-1" /> Copy Summary
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/dashboard/devices/view?id=${selectedDeviceId}`}>
                      <ExternalLink className="w-4 h-4 mr-1" /> View Full Device
                    </a>
                  </Button>
                </div>
              </div>

              {diagLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : (
                <>
                  {/* Status Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        {selectedDevice.status === 'online' ? (
                          <Wifi className="w-4 h-4 text-green-500" />
                        ) : (
                          <WifiOff className="w-4 h-4 text-red-500" />
                        )}
                        <span className="font-medium text-sm">Connection Status</span>
                      </div>
                      <Badge variant={selectedDevice.status === 'online' ? 'default' : 'destructive'}>
                        {selectedDevice.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        Last seen: {selectedDevice.last_seen
                          ? fmt.timeAgo(selectedDevice.last_seen)
                          : 'Never'}
                      </p>
                    </div>

                    <div className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-blue-500" />
                        <span className="font-medium text-sm">Last Telemetry</span>
                      </div>
                      {lastTelemetry ? (
                        <>
                          <p className="text-xs text-muted-foreground">
                            {fmt.timeAgo(lastTelemetry.received_at)}
                          </p>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 max-h-32 overflow-auto">
                            {JSON.stringify(lastTelemetry.telemetry, null, 2)}
                          </pre>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">No telemetry data</p>
                      )}
                    </div>

                    <div className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        <span className="font-medium text-sm">Recent Alerts ({deviceAlerts.length})</span>
                      </div>
                      {deviceAlerts.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No recent alerts</p>
                      ) : (
                        <div className="space-y-1 max-h-32 overflow-auto">
                          {deviceAlerts.slice(0, 5).map(alert => (
                            <div key={alert.id} className="flex items-center gap-1 text-xs">
                              <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                                {alert.severity}
                              </Badge>
                              <span className="truncate">{alert.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Device metadata */}
                  {selectedDevice.metadata && typeof selectedDevice.metadata === 'object' && Object.keys(selectedDevice.metadata as Record<string, unknown>).length > 0 && (
                    <details className="border rounded-lg p-3">
                      <summary className="font-medium text-sm cursor-pointer">Device Metadata</summary>
                      <pre className="text-xs bg-muted p-2 rounded mt-2 max-h-48 overflow-auto">
                        {JSON.stringify(selectedDevice.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Integration Testing ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5" />
            Integration Testing
          </CardTitle>
          <CardDescription>Test configured integration connections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestAll}
              disabled={testingId !== null}
            >
              {testingId === 'all' ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4 mr-1" />
              )}
              Test All ({INTEGRATION_TYPES.length})
            </Button>
          </div>
          <div className="space-y-2">
            {INTEGRATION_TYPES.map(integrationType => {
              const result = testResults[integrationType.id]
              const isTesting = testingId === integrationType.id
              return (
                <div key={integrationType.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{integrationType.label}</Badge>
                    <span className="font-medium text-sm">{integrationType.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result && (
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className={`text-xs max-w-[300px] truncate ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                          {result.message}
                        </span>
                        {result.durationMs && result.durationMs > 0 && (
                          <Badge variant="outline" className="text-[10px]">{result.durationMs}ms</Badge>
                        )}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestIntegrationType(integrationType.id)}
                      disabled={isTesting || testingId === 'all'}
                    >
                      {isTesting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <PlayCircle className="w-4 h-4 mr-1" />
                          Test
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Edge Function Logs ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Edge Function Activity Logs
          </CardTitle>
          <CardDescription>Recent invocations from integration_activity_log (last 24 hours)</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Select value={logTypeFilter} onValueChange={(v) => { setLogTypeFilter(v); setLogsPage(0) }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Activity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="test_connection">Test Connection</SelectItem>
                <SelectItem value="sync_devices">Sync Devices</SelectItem>
                <SelectItem value="webhook_receive">Webhook Receive</SelectItem>
                <SelectItem value="mqtt_data_receive">MQTT Data Receive</SelectItem>
                <SelectItem value="mqtt_subscribe">MQTT Subscribe</SelectItem>
              </SelectContent>
            </Select>
            <Select value={logStatusFilter} onValueChange={(v) => { setLogStatusFilter(v); setLogsPage(0) }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchActivityLogs}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {logsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : activityLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No activity logs found for the selected filters</p>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Activity Type</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Response Time</TableHead>
                      <TableHead>Devices</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLogs.map(log => (
                      <Fragment key={log.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                        >
                          <TableCell className="text-xs">
                            <span title={fmt.dateTime(log.created_at)}>
                              {fmt.timeAgo(log.created_at)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {log.activity_type.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">{log.direction}</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={log.status === 'success' ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {log.response_time_ms != null ? `${log.response_time_ms}ms` : '—'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {log.device_count ?? '—'}
                          </TableCell>
                          <TableCell className="text-xs text-red-600 max-w-[200px] truncate">
                            {log.error_message || '—'}
                          </TableCell>
                          <TableCell>
                            {expandedLogId === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </TableCell>
                        </TableRow>
                        {expandedLogId === log.id && (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/30 p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {log.request_body && (
                                  <div>
                                    <p className="text-xs font-medium mb-1">Request Body</p>
                                    <pre className="text-xs bg-muted p-2 rounded max-h-48 overflow-auto">
                                      {JSON.stringify(log.request_body, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.response_body && (
                                  <div>
                                    <p className="text-xs font-medium mb-1">Response Body</p>
                                    <pre className="text-xs bg-muted p-2 rounded max-h-48 overflow-auto">
                                      {JSON.stringify(log.response_body, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.error_message && (
                                  <div className="md:col-span-2">
                                    <p className="text-xs font-medium mb-1 text-red-600">Error Details</p>
                                    <pre className="text-xs bg-red-50 dark:bg-red-950/20 p-2 rounded">
                                      {log.error_message}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex justify-between items-center mt-3">
                <p className="text-xs text-muted-foreground">
                  Showing {logsPage * LOGS_PAGE_SIZE + 1}–{logsPage * LOGS_PAGE_SIZE + activityLogs.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={logsPage === 0}
                    onClick={() => setLogsPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activityLogs.length < LOGS_PAGE_SIZE}
                    onClick={() => setLogsPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
