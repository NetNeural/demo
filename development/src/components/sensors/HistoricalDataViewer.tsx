'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, Calendar } from 'lucide-react'
import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'
import type { Device } from '@/types/sensor-details'

interface HistoricalDataViewerProps {
  device: Device
}

type TimeRange = '24H' | '48H' | '7D' | '30D' | '90D'

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
  const [selectedRange, setSelectedRange] = useState<TimeRange>('48H')
  const [loading, setLoading] = useState(false)
  const [historicalData, setHistoricalData] = useState<TelemetryData[]>([])
  const useFahrenheit = typeof window !== 'undefined' 
    ? localStorage.getItem('temperatureUnit') === 'F' 
    : false

  const fetchHistoricalData = useCallback(async (range: TimeRange) => {
    if (!currentOrganization) return

    setLoading(true)
    try {
      const supabase = createClient()
      
      // Calculate time range
      let hoursAgo = 48
      if (range === '24H') hoursAgo = 24
      if (range === '7D') hoursAgo = 24 * 7
      if (range === '30D') hoursAgo = 24 * 30
      if (range === '90D') hoursAgo = 24 * 90

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
    fetchHistoricalData(selectedRange)
  }, [fetchHistoricalData, selectedRange])

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
        {/* Time Range Selector */}
        <div className="flex flex-wrap gap-2">
          {(['24H', '48H', '7D', '30D', '90D'] as TimeRange[]).map(range => (
            <Button
              key={range}
              size="sm"
              variant={selectedRange === range ? 'default' : 'outline'}
              onClick={() => setSelectedRange(range)}
              disabled={loading}
            >
              {range}
            </Button>
          ))}
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
                <Badge variant="secondary">{historicalData.length.toLocaleString()}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Range: </span>
                <span className="font-medium">{selectedRange}</span>
              </div>
            </div>

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
                    {historicalData.map((row, idx) => (
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
