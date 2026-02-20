'use client'

// Updated: 2026-02-16 - Added gradient fills to chart visualization

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, Calendar } from 'lucide-react'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'
import type { Device } from '@/types/sensor-details'
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface HistoricalDataViewerProps {
  device: Device
}

type TimeRange = '1H' | '6H' | '12H' | '24H' | 'custom'

interface CustomTimeRange {
  hours: number
  label: string
}

const SENSOR_LABELS: Record<number, string> = {
  1: 'Temperature',
  2: 'Humidity',
  3: 'Pressure',
  4: 'CO₂',
  5: 'VOC',
  6: 'Light',
  7: 'Motion',
}

const UNIT_LABELS: Record<number, string> = {
  1: '°C',
  2: '°F',
  3: '%',
  4: 'hPa',
  5: 'ppm',
  6: 'ppb',
  7: 'lux',
}

interface TelemetryData {
  device_id: string
  telemetry: {
    type?: number
    units?: number
    value?: number
    sensor?: string
    [key: string]: unknown
  } | null
  device_timestamp: string | null
  received_at: string
}

export function HistoricalDataViewer({ device }: HistoricalDataViewerProps) {
  const { currentOrganization } = useOrganization()
  const [selectedRange, setSelectedRange] = useState<TimeRange>('24H')
  const [selectedSensor, setSelectedSensor] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [historicalData, setHistoricalData] = useState<TelemetryData[]>([])
  const [customHours, setCustomHours] = useState<string>('48')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const useFahrenheit = typeof window !== 'undefined' 
    ? (localStorage.getItem('temperatureUnit') ?? 'F') === 'F'
    : true

  const fetchHistoricalData = useCallback(async (range: TimeRange, customHoursValue?: number) => {
    if (!currentOrganization) return

    setLoading(true)
    try {
      const supabase = createClient()
      
      // Calculate time range
      let hoursAgo = 24
      if (range === '1H') hoursAgo = 1
      if (range === '6H') hoursAgo = 6
      if (range === '12H') hoursAgo = 12
      if (range === '24H') hoursAgo = 24
      if (range === 'custom' && customHoursValue) hoursAgo = customHoursValue

      const startTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from('device_telemetry_history')
        .select('*')
        .eq('device_id', device.id)
        .eq('organization_id', currentOrganization.id)
        .gte('received_at', startTime)
        .order('received_at', { ascending: false })
        .limit(500)

      if (error) throw error
      
      // Cast the data to our expected type
      const typedData = (data || []).map(row => ({
        device_id: row.device_id,
        telemetry: row.telemetry as TelemetryData['telemetry'],
        device_timestamp: row.device_timestamp,
        received_at: row.received_at
      }))
      
      setHistoricalData(typedData)
    } catch (err) {
      console.error('[HistoricalDataViewer] Error:', err)
      setHistoricalData([])
    } finally {
      setLoading(false)
    }
  }, [device.id, currentOrganization])

  // Auto-load data on mount
  useEffect(() => {
    if (selectedRange === 'custom') {
      const hours = parseInt(customHours, 10)
      if (!isNaN(hours) && hours > 0) {
        fetchHistoricalData(selectedRange, hours)
      }
    } else {
      fetchHistoricalData(selectedRange)
    }
  }, [fetchHistoricalData, selectedRange, customHours])

  const handleCustomRangeApply = () => {
    const hours = parseInt(customHours, 10)
    if (!isNaN(hours) && hours > 0 && hours <= 2160) { // Max 90 days
      setSelectedRange('custom')
      setShowCustomInput(false)
    }
  }

  const formatValue = (telemetry: TelemetryData['telemetry']) => {
    if (!telemetry || telemetry.value == null) return 'N/A'
    
    let value = Number(telemetry.value)
    let unit = telemetry.units != null ? UNIT_LABELS[telemetry.units] || '' : ''
    
    // Convert temperature if needed
    const isTemperature = telemetry.type === 1 || unit === '°C' || unit === '°F'
    if (isTemperature && useFahrenheit && unit === '°C') {
      value = (value * 9/5) + 32
      unit = '°F'
    } else if (isTemperature && !useFahrenheit && unit === '°F') {
      value = (value - 32) * 5/9
      unit = '°C'
    }
    
    return `${value.toFixed(1)}${unit}`
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getSensorLabel = (telemetry: TelemetryData['telemetry']) => {
    if (!telemetry) return 'Unknown'
    if (telemetry.type != null) {
      return SENSOR_LABELS[telemetry.type] || `Sensor ${telemetry.type}`
    }
    return telemetry.sensor || 'Unknown'
  }

  const exportToCSV = () => {
    if (historicalData.length === 0) return

    const headers = ['Timestamp', 'Sensor', 'Value', 'Unit']
    const rows = historicalData.map(row => {
      const sensorLabel = getSensorLabel(row.telemetry)
      const value = row.telemetry?.value != null ? Number(row.telemetry.value).toFixed(1) : ''
      const unit = row.telemetry?.units != null ? UNIT_LABELS[row.telemetry.units] || '' : ''
      return [
        row.received_at,
        sensorLabel,
        value,
        unit
      ]
    })

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${device.name}-${selectedRange}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Process data for line chart
  const chartData = useMemo(() => {
    if (historicalData.length === 0) return []

    // Sort data by timestamp ascending for proper line chart
    const sortedData = [...historicalData].sort((a, b) => 
      new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
    )

    // Group readings by timestamp (combine multiple sensors at same time)
    const groupedByTime = new Map<number, Record<string, number | string>>()
    
    sortedData.forEach(row => {
      const timestamp = new Date(row.received_at).getTime()
      const sensorType = row.telemetry?.type
      const sensorLabel = SENSOR_LABELS[sensorType || 0] || 'Unknown'
      let value = row.telemetry?.value || 0

      // Apply temperature conversion if needed
      if (sensorType === 1 && useFahrenheit) {
        value = (value * 9/5) + 32
      }

      if (!groupedByTime.has(timestamp)) {
        groupedByTime.set(timestamp, {
          timestamp,
          timeLabel: formatTimestamp(row.received_at)
        })
      }

      const timeEntry = groupedByTime.get(timestamp)!
      timeEntry[sensorLabel] = value
    })

    return Array.from(groupedByTime.values())
  }, [historicalData, useFahrenheit])

  // Get unique sensor types for the chart
  const sensorTypes = useMemo(() => {
    const types = new Set<string>()
    historicalData.forEach(row => {
      const sensorType = row.telemetry?.type
      const label = SENSOR_LABELS[sensorType || 0]
      if (label) types.add(label)
    })
    return Array.from(types)
  }, [historicalData])

  // Filter data based on selected sensor
  const filteredHistoricalData = useMemo(() => {
    if (selectedSensor === 'all') return historicalData
    
    return historicalData.filter(row => {
      const sensorType = row.telemetry?.type
      const label = SENSOR_LABELS[sensorType || 0]
      return label === selectedSensor
    })
  }, [historicalData, selectedSensor])

  // Filter sensor types for chart based on selection
  const visibleSensorTypes = useMemo(() => {
    if (selectedSensor === 'all') return sensorTypes
    return sensorTypes.filter(type => type === selectedSensor)
  }, [sensorTypes, selectedSensor])

  // Color palette for different sensors
  const sensorColors: Record<string, string> = {
    'Temperature': '#ef4444',
    'Humidity': '#3b82f6',
    'Pressure': '#10b981',
    'CO₂': '#f59e0b',
    'VOC': '#8b5cf6',
    'Light': '#eab308',
    'Motion': '#06b6d4'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            🗃️ Historical Data
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={exportToCSV}
              disabled={historicalData.length === 0 || loading}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Time Range and Sensor Selector */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Time Range Buttons */}
          <div className="flex flex-wrap gap-2 items-center">
            {(['1H', '6H', '12H', '24H'] as TimeRange[]).map(range => (
              <Button
                key={range}
                size="sm"
                variant={selectedRange === range ? 'default' : 'outline'}
                onClick={() => {
                  setSelectedRange(range)
                  setShowCustomInput(false)
                }}
                disabled={loading}
              >
                {range}
              </Button>
            ))}
            <Button
              size="sm"
              variant={showCustomInput || selectedRange === 'custom' ? 'default' : 'outline'}
              onClick={() => setShowCustomInput(!showCustomInput)}
              disabled={loading}
            >
              Custom
            </Button>
          </div>
          
          {/* Custom Time Range Input */}
          {showCustomInput && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Hours:</span>
              <Input
                type="number"
                min={1}
                max={2160}
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                className="w-20"
                placeholder="48"
              />
              <Button
                size="sm"
                onClick={handleCustomRangeApply}
                disabled={loading || !customHours || parseInt(customHours, 10) <= 0}
              >
                Apply
              </Button>
            </div>
          )}
          
          {/* Sensor Type Dropdown */}
          {sensorTypes.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Sensor:</span>
              <Select
                value={selectedSensor}
                onValueChange={setSelectedSensor}
                disabled={loading}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select sensor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sensors</SelectItem>
                  {sensorTypes.map((sensorType) => (
                    <SelectItem key={sensorType} value={sensorType}>
                      {sensorType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Data Summary */}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground mt-2">Loading historical data...</p>
          </div>
        ) : historicalData.length > 0 ? (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="flex items-center justify-between text-sm p-3 bg-muted/50 rounded-lg">
              <div>
                <span className="text-muted-foreground">Data Points: </span>
                <Badge variant="secondary">{filteredHistoricalData.length.toLocaleString()}</Badge>
              </div>
              <div className="flex items-center gap-3">
                {selectedSensor !== 'all' && (
                  <>
                    <Badge variant="outline">{selectedSensor}</Badge>
                    <span className="text-muted-foreground">|</span>
                  </>
                )}
                <div>
                  <span className="text-muted-foreground">Range: </span>
                  <span className="font-medium">{selectedRange}</span>
                </div>
              </div>
            </div>

            {/* Trend Chart */}
            {chartData.length > 0 && (
              <div className="border rounded-lg p-4 bg-muted/20">
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartData}>
                    <defs>
                      {visibleSensorTypes.map((sensorType) => (
                        <linearGradient key={`gradient-${sensorType}`} id={`gradient-${sensorType}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={sensorColors[sensorType] || '#6b7280'} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={sensorColors[sensorType] || '#6b7280'} stopOpacity={0.1}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="timestamp"
                      type="number"
                      domain={['auto', 'auto']}
                      tickFormatter={(timestamp) => {
                        const date = new Date(timestamp)
                        
                        // For 24H range, show time only
                        if (selectedRange === '24H') {
                          return date.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })
                        }
                        // For longer ranges, show date + time
                        return date.toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit'
                        })
                      }}
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 12 }}
                      width={60}
                    />
                    <Tooltip 
                      labelFormatter={(timestamp) => {
                        return new Date(timestamp as number).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      }}
                      formatter={(value: number | string | undefined, name: string | undefined) => {
                        if (value === undefined || name === undefined) return ['N/A', name || 'Unknown']
                        const unit = name === 'Temperature' 
                          ? (useFahrenheit ? '°F' : '°C')
                          : UNIT_LABELS[historicalData.find(d => SENSOR_LABELS[d.telemetry?.type || 0] === name)?.telemetry?.units || 0] || ''
                        return [typeof value === 'number' ? value.toFixed(1) : value, `${name} ${unit}`]
                      }}
                    />
                    <Legend />
                    {visibleSensorTypes.map((sensorType) => (
                      <Area
                        key={sensorType}
                        type="monotone"
                        dataKey={sensorType}
                        stroke={sensorColors[sensorType] || '#6b7280'}
                        strokeWidth={2}
                        fill={`url(#gradient-${sensorType})`}
                        fillOpacity={1}
                        dot={false}
                        connectNulls
                        name={sensorType}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Data Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">Timestamp</th>
                      <th className="text-left p-2 font-medium">Sensor</th>
                      <th className="text-right p-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredHistoricalData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="p-2 text-muted-foreground">
                          {formatTimestamp(row.received_at)}
                        </td>
                        <td className="p-2">{getSensorLabel(row.telemetry)}</td>
                        <td className="p-2 text-right font-medium">
                          {formatValue(row.telemetry)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Showing up to 500 most recent readings. Use Export CSV for complete data.
            </p>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No historical data available for this time range</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
