'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { AIReportSummary } from '@/components/reports/AIReportSummary'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import {
  LineChart as LineChartIcon,
  Table as TableIcon,
  Download,
  Calendar as CalendarIcon,
  Activity,
  AlertTriangle,
  Send,
} from 'lucide-react'
import {
  SendReportDialog,
  type ReportPayload,
} from '@/components/reports/SendReportDialog'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'
import { format, subHours } from 'date-fns'

// Lazy singleton — avoids calling createClient() at module eval time
// (which fails during static export since env vars aren't available)
// but still preserves referential stability to prevent infinite useEffect loops.
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

interface Device {
  id: string
  name: string
}

interface TelemetryDataPoint {
  timestamp: string
  time: number
  [deviceId: string]: number | string
}

interface DeviceStats {
  deviceId: string
  deviceName: string
  min: number
  max: number
  avg: number
  color: string
}

interface Threshold {
  device_id: string
  sensor_type: string
  min_value: number | null
  max_value: number | null
  critical_min: number | null
  critical_max: number | null
  temperature_unit?: string
}

interface BreachPeriod {
  start: number
  end: number
  type: 'warning' | 'critical'
}

const SENSOR_TYPES = [
  { value: 'temperature', label: 'Temperature', unit: '°C' },
  { value: 'humidity', label: 'Humidity', unit: '%' },
  { value: 'pressure', label: 'Pressure', unit: 'hPa' },
  { value: 'battery', label: 'Battery', unit: '%' },
  { value: 'rssi', label: 'Signal Strength', unit: 'dBm' },
  { value: 'co2', label: 'CO₂', unit: 'ppm' },
  { value: 'voc', label: 'VOC', unit: 'ppb' },
  { value: 'light', label: 'Light', unit: 'lux' },
]

const TIME_RANGES = [
  { value: '1h', label: 'Last Hour', hours: 1 },
  { value: '6h', label: 'Last 6 Hours', hours: 6 },
  { value: '24h', label: 'Last 24 Hours', hours: 24 },
  { value: '7d', label: 'Last 7 Days', hours: 168 },
  { value: '30d', label: 'Last 30 Days', hours: 720 },
  { value: 'custom', label: 'Custom Range', hours: 0 },
]

const DEVICE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ef4444', // red
]

export function TelemetryTrendsReport() {
  const { currentOrganization } = useOrganization()
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDevices, setSelectedDevices] = useState<string[]>([])
  const [selectedSensor, setSelectedSensor] = useState<string>('temperature')
  const [timeRange, setTimeRange] = useState<string>('24h')
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: undefined,
    to: undefined,
  })
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')
  const [telemetryData, setTelemetryData] = useState<TelemetryDataPoint[]>([])
  const [thresholds, setThresholds] = useState<Threshold[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  // Issue #276: Track if query results were truncated
  const [dataLimited, setDataLimited] = useState(false)
  const TELEMETRY_ROW_LIMIT = 1000

  // Fetch devices
  useEffect(() => {
    if (!currentOrganization) return

    const fetchDevices = async () => {
      const { data, error } = await getSupabase()
        .from('devices')
        .select('id, name')
        .eq('organization_id', currentOrganization.id)
        .order('name')

      if (!error && data) {
        setDevices(data as Device[])
      }
    }

    fetchDevices()
  }, [currentOrganization])

  // Fetch thresholds for selected devices
  useEffect(() => {
    if (selectedDevices.length === 0) return

    const fetchThresholds = async () => {
      const { data, error } = await getSupabase()
        .from('sensor_thresholds')
        .select(
          'device_id, sensor_type, min_value, max_value, critical_min, critical_max'
        )
        .in('device_id', selectedDevices)
        .eq('sensor_type', selectedSensor)

      if (!error && data) {
        setThresholds(data)
      }
    }

    fetchThresholds()
  }, [selectedDevices, selectedSensor])

  // Fetch telemetry data
  const fetchTelemetryData = useCallback(async () => {
    if (!currentOrganization || selectedDevices.length === 0) return

    setLoading(true)
    try {
      let startDate: Date
      let endDate = new Date()

      if (timeRange === 'custom') {
        if (!customDateRange.from || !customDateRange.to) return
        startDate = customDateRange.from
        endDate = customDateRange.to
      } else {
        const range = TIME_RANGES.find((r) => r.value === timeRange)
        startDate = subHours(new Date(), range?.hours || 24)
      }

      const { data, error } = await getSupabase()
        .from('device_telemetry_history')
        .select('device_id, telemetry, device_timestamp, received_at')
        .in('device_id', selectedDevices)
        .gte('received_at', startDate.toISOString())
        .lte('received_at', endDate.toISOString())
        .order('received_at', { ascending: true })
        .limit(TELEMETRY_ROW_LIMIT) // Issue #276: Prevent unbounded queries

      if (error) throw error

      // Issue #276: Detect if data was truncated
      setDataLimited(data?.length === TELEMETRY_ROW_LIMIT)

      // Process data into chart format
      const processedData: Map<number, TelemetryDataPoint> = new Map()

      data?.forEach((record: any) => {
        const timestamp = record.device_timestamp || record.received_at
        const timeMs = new Date(timestamp).getTime()
        const value =
          record.telemetry?.[selectedSensor] || record.telemetry?.value // fallback for generic value field

        if (value === undefined || value === null) return

        if (!processedData.has(timeMs)) {
          processedData.set(timeMs, {
            timestamp: timestamp,
            time: timeMs,
          })
        }

        const dataPoint = processedData.get(timeMs)!
        dataPoint[record.device_id] =
          typeof value === 'number' ? value : parseFloat(value)
      })

      const sortedData = Array.from(processedData.values()).sort(
        (a, b) => a.time - b.time
      )
      setTelemetryData(sortedData)
    } catch (error) {
      console.error('Error fetching telemetry:', error)
    } finally {
      setLoading(false)
    }
  }, [
    currentOrganization,
    selectedDevices,
    selectedSensor,
    timeRange,
    customDateRange,
  ])

  useEffect(() => {
    fetchTelemetryData()
  }, [fetchTelemetryData])

  // Calculate statistics
  const statistics = useMemo((): DeviceStats[] => {
    return selectedDevices.map((deviceId, index) => {
      const deviceData = devices.find((d) => d.id === deviceId)
      const color = DEVICE_COLORS[index % DEVICE_COLORS.length] || '#3b82f6'
      const values = telemetryData
        .map((d) => d[deviceId])
        .filter((v): v is number => typeof v === 'number' && !isNaN(v))

      if (values.length === 0) {
        return {
          deviceId,
          deviceName: deviceData?.name || 'Unknown',
          min: 0,
          max: 0,
          avg: 0,
          color,
        }
      }

      const min = Math.min(...values)
      const max = Math.max(...values)
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length

      return {
        deviceId,
        deviceName: deviceData?.name || 'Unknown',
        min,
        max,
        avg,
        color,
      }
    })
  }, [selectedDevices, telemetryData, devices])

  // Identify threshold breaches
  const breachPeriods = useMemo((): BreachPeriod[] => {
    const periods: BreachPeriod[] = []

    selectedDevices.forEach((deviceId) => {
      const threshold = thresholds.find((t) => t.device_id === deviceId)
      if (!threshold) return

      let currentBreach: BreachPeriod | null = null

      telemetryData.forEach((point, index) => {
        const value = point[deviceId] as number | undefined
        if (value === undefined) return

        // Check critical range breach (outside critical_min to critical_max)
        const isCritical =
          (threshold.critical_min !== null && value < threshold.critical_min) ||
          (threshold.critical_max !== null && value > threshold.critical_max)

        // Check warning range breach (outside min_value to max_value, but not critical)
        const isWarning =
          !isCritical &&
          ((threshold.min_value !== null && value < threshold.min_value) ||
            (threshold.max_value !== null && value > threshold.max_value))

        if (isCritical || isWarning) {
          if (!currentBreach) {
            currentBreach = {
              start: point.time,
              end: point.time,
              type: isCritical ? 'critical' : 'warning',
            }
          } else {
            currentBreach.end = point.time
            // Upgrade to critical if needed
            if (isCritical && currentBreach.type === 'warning') {
              currentBreach.type = 'critical'
            }
          }
        } else if (currentBreach) {
          periods.push(currentBreach)
          currentBreach = null
        }

        // Push remaining breach at the end
        if (index === telemetryData.length - 1 && currentBreach) {
          periods.push(currentBreach)
        }
      })
    })

    return periods
  }, [selectedDevices, telemetryData, thresholds])

  // Handle device selection (max 5)
  const handleDeviceToggle = (deviceId: string) => {
    setSelectedDevices((prev) => {
      if (prev.includes(deviceId)) {
        return prev.filter((id) => id !== deviceId)
      } else if (prev.length < 5) {
        return [...prev, deviceId]
      }
      return prev
    })
  }

  // CSV Export
  const exportToCSV = () => {
    const sensorInfo = SENSOR_TYPES.find((s) => s.value === selectedSensor)
    const rows = [
      [
        'Timestamp',
        ...statistics.map((s) => `${s.deviceName} (${sensorInfo?.unit || ''})`),
      ],
    ]

    telemetryData.forEach((point) => {
      const row = [
        format(new Date(point.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        ...selectedDevices.map((deviceId) => {
          const value = point[deviceId]
          return typeof value === 'number' ? value.toFixed(2) : ''
        }),
      ]
      rows.push(row)
    })

    const csv = rows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `telemetry-trends-${selectedSensor}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Build payload for SendReportDialog
  const getReportPayload = (): ReportPayload => {
    const rows: string[][] = [
      [
        'Timestamp',
        ...statistics.map((s) => `${s.deviceName} (${sensorInfo?.unit || ''})`),
      ],
    ]
    telemetryData.forEach((point) => {
      rows.push([
        format(new Date(point.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        ...selectedDevices.map((deviceId) => {
          const value = point[deviceId]
          return typeof value === 'number' ? value.toFixed(2) : ''
        }),
      ])
    })
    const csv = rows.map((r) => r.join(',')).join('\n')
    const deviceNames = statistics.map((s) => s.deviceName).join(', ')
    return {
      title: 'Telemetry Trends Report',
      csvContent: csv,
      csvFilename: `telemetry-trends-${selectedSensor}-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      smsSummary: `${telemetryData.length} data points for ${selectedDevices.length} device(s) (${deviceNames}). Sensor: ${sensorInfo?.label || selectedSensor}. Time range: ${timeRange}.`,
    }
  }

  const filteredDevices = devices.filter((device) =>
    device.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const sensorInfo = SENSOR_TYPES.find((s) => s.value === selectedSensor)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <OrganizationLogo
          settings={currentOrganization?.settings}
          name={currentOrganization?.name || 'NetNeural'}
          size="xl"
        />
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Telemetry Trends
          </h2>
          <p className="text-muted-foreground">
            Compare sensor data across devices over time
          </p>
        </div>
      </div>

      {/* AI Report Summary */}
      {telemetryData.length > 0 && currentOrganization && (
        <>
          {/* Issue #276: Truncation notice */}
          {dataLimited && (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
              Showing latest {TELEMETRY_ROW_LIMIT.toLocaleString()} data points.
              Narrow the date range for complete data.
            </div>
          )}
          <AIReportSummary
            reportType="telemetry-trends"
            reportData={{
              dateRange:
                timeRange === '24h'
                  ? 'Last 24 hours'
                  : timeRange === '7d'
                    ? 'Last 7 days'
                    : timeRange === '30d'
                      ? 'Last 30 days'
                      : customDateRange.from && customDateRange.to
                        ? `${format(customDateRange.from, 'MMM d, yyyy')} - ${format(customDateRange.to, 'MMM d, yyyy')}`
                        : 'Custom',
              totalRecords: telemetryData.length,
              metadata: {
                selectedDevices: selectedDevices.length,
                sensorType: selectedSensor,
                deviceStats: statistics.map((stat) => ({
                  device: stat.deviceName,
                  min: stat.min,
                  max: stat.max,
                  avg: stat.avg,
                })),
              },
            }}
            organizationId={currentOrganization.id}
          />
        </>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Select up to 5 devices, choose sensor type, and time range
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Device Selection */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Devices ({selectedDevices.length}/5)
            </label>
            <input
              type="text"
              placeholder="Search devices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-2 w-full rounded-md border px-3 py-2"
            />
            <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border p-4">
              {filteredDevices.map((device) => (
                <label
                  key={device.id}
                  className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={selectedDevices.includes(device.id)}
                    onChange={() => handleDeviceToggle(device.id)}
                    disabled={
                      !selectedDevices.includes(device.id) &&
                      selectedDevices.length >= 5
                    }
                    className="rounded"
                  />
                  <span>{device.name}</span>
                  {selectedDevices.includes(device.id) && (
                    <Badge
                      style={{
                        backgroundColor:
                          DEVICE_COLORS[
                            selectedDevices.indexOf(device.id) %
                              DEVICE_COLORS.length
                          ],
                      }}
                      className="ml-auto"
                    >
                      Selected
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Sensor Type & Time Range */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Sensor Type
              </label>
              <Select value={selectedSensor} onValueChange={setSelectedSensor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SENSOR_TYPES.map((sensor) => (
                    <SelectItem key={sensor.value} value={sensor.value}>
                      {sensor.label} ({sensor.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Time Range
              </label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGES.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {timeRange === 'custom' && (
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Custom Date Range
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDateRange.from && customDateRange.to
                        ? `${format(customDateRange.from, 'MMM d')} - ${format(customDateRange.to, 'MMM d')}`
                        : 'Select dates'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={{
                        from: customDateRange.from,
                        to: customDateRange.to,
                      }}
                      onSelect={(range) =>
                        setCustomDateRange({ from: range?.from, to: range?.to })
                      }
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={fetchTelemetryData}
              disabled={loading || selectedDevices.length === 0}
            >
              {loading ? 'Loading...' : 'Update Chart'}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setViewMode(viewMode === 'chart' ? 'table' : 'chart')
              }
              disabled={selectedDevices.length === 0}
            >
              {viewMode === 'chart' ? (
                <TableIcon className="mr-2 h-4 w-4" />
              ) : (
                <LineChartIcon className="mr-2 h-4 w-4" />
              )}
              {viewMode === 'chart' ? 'Table View' : 'Chart View'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setSendDialogOpen(true)}
              disabled={telemetryData.length === 0}
            >
              <Send className="mr-2 h-4 w-4" />
              Send Report
            </Button>
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={telemetryData.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <SendReportDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        getReportPayload={getReportPayload}
      />

      {/* Statistics */}
      {statistics.length > 0 && telemetryData.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {statistics.map((stat) => (
            <Card key={stat.deviceId}>
              <CardHeader className="pb-3">
                <CardTitle className="truncate text-sm font-medium">
                  {stat.deviceName}
                </CardTitle>
                <Badge
                  style={{ backgroundColor: stat.color }}
                  className="w-fit"
                >
                  {sensorInfo?.label}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Min:</span>
                  <span className="font-medium">
                    {stat.min.toFixed(2)} {sensorInfo?.unit}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max:</span>
                  <span className="font-medium">
                    {stat.max.toFixed(2)} {sensorInfo?.unit}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg:</span>
                  <span className="font-medium">
                    {stat.avg.toFixed(2)} {sensorInfo?.unit}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chart or Table */}
      {selectedDevices.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="space-y-3 text-center">
              <Activity className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                Select at least one device to view telemetry trends
              </p>
            </div>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading telemetry data...</p>
          </CardContent>
        </Card>
      ) : telemetryData.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="space-y-3 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                No telemetry data found for the selected configuration
              </p>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'chart' ? (
        <Card>
          <CardHeader>
            <CardTitle>{sensorInfo?.label || 'Sensor'} Trends</CardTitle>
            <CardDescription>
              {(() => {
                const firstPoint = telemetryData[0]
                const lastPoint = telemetryData[telemetryData.length - 1]
                if (
                  telemetryData.length > 0 &&
                  firstPoint?.timestamp &&
                  lastPoint?.timestamp
                ) {
                  return (
                    <>
                      {telemetryData.length} data points from{' '}
                      {format(new Date(firstPoint.timestamp), 'MMM d, HH:mm')}{' '}
                      to {format(new Date(lastPoint.timestamp), 'MMM d, HH:mm')}
                    </>
                  )
                }
                return null
              })()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={telemetryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(time) =>
                    format(new Date(time), 'MMM d HH:mm')
                  }
                />
                <YAxis
                  label={{
                    value: sensorInfo?.unit || '',
                    angle: -90,
                    position: 'insideLeft',
                  }}
                />
                <Tooltip
                  labelFormatter={(time) =>
                    format(new Date(time as number), 'MMM d, yyyy HH:mm:ss')
                  }
                  formatter={(value: any) => [
                    `${Number(value).toFixed(2)} ${sensorInfo?.unit}`,
                    '',
                  ]}
                />
                <Legend />

                {/* Threshold Lines */}
                {thresholds.map((threshold) => (
                  <React.Fragment key={threshold.device_id}>
                    {/* Warning thresholds */}
                    {threshold.min_value !== null && (
                      <ReferenceLine
                        y={threshold.min_value}
                        stroke="#f59e0b"
                        strokeDasharray="3 3"
                        label={{
                          value: 'Warning Min',
                          position: 'right',
                          fill: '#f59e0b',
                        }}
                      />
                    )}
                    {threshold.max_value !== null && (
                      <ReferenceLine
                        y={threshold.max_value}
                        stroke="#f59e0b"
                        strokeDasharray="3 3"
                        label={{
                          value: 'Warning Max',
                          position: 'right',
                          fill: '#f59e0b',
                        }}
                      />
                    )}

                    {/* Critical thresholds */}
                    {threshold.critical_min !== null && (
                      <ReferenceLine
                        y={threshold.critical_min}
                        stroke="#ef4444"
                        strokeDasharray="3 3"
                        label={{
                          value: 'Critical Min',
                          position: 'right',
                          fill: '#ef4444',
                        }}
                      />
                    )}
                    {threshold.critical_max !== null && (
                      <ReferenceLine
                        y={threshold.critical_max}
                        stroke="#ef4444"
                        strokeDasharray="3 3"
                        label={{
                          value: 'Critical Max',
                          position: 'right',
                          fill: '#ef4444',
                        }}
                      />
                    )}
                  </React.Fragment>
                ))}

                {/* Breach Periods */}
                {breachPeriods.map((period, index) => (
                  <ReferenceArea
                    key={index}
                    x1={period.start}
                    x2={period.end}
                    fill={period.type === 'critical' ? '#ef4444' : '#f59e0b'}
                    fillOpacity={0.1}
                  />
                ))}

                {/* Device Lines */}
                {selectedDevices.map((deviceId, index) => {
                  const deviceName =
                    devices.find((d) => d.id === deviceId)?.name || 'Unknown'
                  return (
                    <Line
                      key={deviceId}
                      type="monotone"
                      dataKey={deviceId}
                      name={deviceName}
                      stroke={DEVICE_COLORS[index % DEVICE_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Telemetry Data Table</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50">
                    <tr>
                      <th className="p-2 text-left font-medium">Timestamp</th>
                      {statistics.map((stat) => (
                        <th
                          key={stat.deviceId}
                          className="p-2 text-right font-medium"
                        >
                          {stat.deviceName}
                          <br />
                          <span className="text-xs font-normal text-muted-foreground">
                            ({sensorInfo?.unit})
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {telemetryData.map((point, index) => (
                      <tr key={index} className="hover:bg-muted/30">
                        <td className="p-2 text-muted-foreground">
                          {format(
                            new Date(point.timestamp),
                            'MMM d, yyyy HH:mm:ss'
                          )}
                        </td>
                        {selectedDevices.map((deviceId) => {
                          const value = point[deviceId]
                          return (
                            <td key={deviceId} className="p-2 text-right">
                              {typeof value === 'number'
                                ? value.toFixed(2)
                                : '-'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
