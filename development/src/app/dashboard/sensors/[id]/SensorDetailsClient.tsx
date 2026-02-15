'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react'
import { SensorOverviewCard } from '@/components/sensors/SensorOverviewCard'
import { SensorTrendGraph } from '@/components/sensors/SensorTrendGraph'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import type { 
  SensorDetailsData, 
  TimeRange, 
  SensorReading, 
  SensorThreshold, 
  SensorActivity 
} from '@/types/sensor-details'

// Helper to extract number from telemetry value
function extractNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'value' in value) {
    const obj = value as { value: unknown }
    if (typeof obj.value === 'number') return obj.value
  }
  return null
}

// Helper to extract metadata from telemetry value
function extractMetadata(value: unknown): { unit?: string; quality?: number } {
  const result: { unit?: string; quality?: number } = {}
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.unit === 'string') result.unit = obj.unit
    if (typeof obj.quality === 'number') result.quality = obj.quality
  }
  return result
}

// Helper to get default unit for sensor type
function getDefaultUnit(sensorType: string): string {
  const units: Record<string, string> = {
    temperature: '°C', humidity: '%', pressure: 'hPa', battery: 'V',
    voltage: 'V', current: 'A', power: 'W', energy: 'kWh',
    distance: 'm', speed: 'm/s', acceleration: 'm/s²',
    angle: '°', frequency: 'Hz', luminosity: 'lux', sound: 'dB',
    co2: 'ppm', voc: 'ppb',
  }
  return units[sensorType.toLowerCase()] || ''
}

export default function SensorDetailsClient() {
  const params = useParams()
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  
  const deviceId = params?.id as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SensorDetailsData | null>(null)
  const [selectedSensor, setSelectedSensor] = useState<string>('temperature')
  const [timeRange, setTimeRange] = useState<TimeRange>('48h')

  const fetchSensorData = useCallback(async () => {
    if (!currentOrganization || !deviceId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()

      // Verify device belongs to organization
      const { data: device, error: deviceError } = await supabase
        .from('devices')
        .select('*')
        .eq('id', deviceId)
        .eq('organization_id', currentOrganization.id)
        .single()

      if (deviceError || !device) {
        throw new Error('Device not found')
      }

      // Calculate time range
      const timeRangeHours: Record<string, number> = {
        '48h': 48, '7d': 168, '30d': 720, '90d': 2160,
      }
      const hours = timeRangeHours[timeRange] || 48
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

      // Fetch telemetry data
      const { data: telemetryRecords } = await supabase
        .from('device_telemetry_history')
        .select('telemetry, created_at, device_timestamp')
        .eq('device_id', deviceId)
        .gte('created_at', startTime)
        .order('created_at', { ascending: false })
        .limit(1000)

      // Extract sensor readings from JSONB
      const readings: Array<{ timestamp: string; value: number; quality: number | null; unit?: string }> = []
      let latestReading: typeof readings[0] & { id: string; device_id: string; sensor_type: string; created_at: string } | null = null

      if (telemetryRecords && telemetryRecords.length > 0) {
        for (const record of telemetryRecords) {
          const telemetry = record.telemetry as Record<string, unknown>
          let sensorValue: number | null = null
          let sensorUnit: string | null = null
          let quality: number | null = 95

          // Try direct property
          if (selectedSensor in telemetry) {
            sensorValue = extractNumber(telemetry[selectedSensor])
            const metadata = extractMetadata(telemetry[selectedSensor])
            sensorUnit = metadata.unit ?? null
            quality = metadata.quality ?? quality
          }
          
          // Try nested in metrics
          if (sensorValue === null && 'metrics' in telemetry && telemetry.metrics && typeof telemetry.metrics === 'object') {
            const metrics = telemetry.metrics as Record<string, unknown>
            if (selectedSensor in metrics) {
              sensorValue = extractNumber(metrics[selectedSensor])
              const metadata = extractMetadata(metrics[selectedSensor])
              sensorUnit = metadata.unit ?? null
              quality = metadata.quality ?? quality
            }
          }
          
          // Try in data object
          if (sensorValue === null && 'data' in telemetry && telemetry.data && typeof telemetry.data === 'object') {
            const dataObj = telemetry.data as Record<string, unknown>
            if (selectedSensor in dataObj) {
              sensorValue = extractNumber(dataObj[selectedSensor])
              const metadata = extractMetadata(dataObj[selectedSensor])
              sensorUnit = metadata.unit ?? null
              quality = metadata.quality ?? quality
            }
          }

          if (sensorValue !== null) {
            const reading = {
              timestamp: record.device_timestamp || record.created_at,
              value: sensorValue,
              quality,
              unit: sensorUnit || getDefaultUnit(selectedSensor)
            }
            
            readings.push(reading)
            
            if (!latestReading) {
              latestReading = {
                ...reading,
                id: `${deviceId}_${selectedSensor}_latest`,
                device_id: deviceId,
                sensor_type: selectedSensor,
                created_at: record.created_at,
              }
            }
          }
        }
      }

      // Calculate statistics
      const trendData = readings.map(r => ({ timestamp: r.timestamp, value: r.value, quality: r.quality }))
      let statistics = null

      if (trendData.length > 0) {
        const values = trendData.map(r => r.value)
        const min = Math.min(...values)
        const max = Math.max(...values)
        const avg = values.reduce((a, b) => a + b, 0) / values.length
        const squareDiffs = values.map(v => Math.pow(v - avg, 2))
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length
        const stddev = Math.sqrt(avgSquareDiff)

        statistics = {
          current: latestReading?.value || 0,
          min, max, avg, stddev,
          readings_count: trendData.length,
          last_updated: latestReading?.timestamp || new Date().toISOString(),
        }
      }

      // Fetch threshold
      const { data: threshold } = await supabase
        .from('sensor_thresholds')
        .select('*')
        .eq('device_id', deviceId)
        .eq('sensor_type', selectedSensor)
        .single()

      // Fetch activity
      const { data: recentActivity } = await supabase
        .from('sensor_activity')
        .select('*')
        .eq('device_id', deviceId)
        .eq('sensor_type', selectedSensor)
        .order('occurred_at', { ascending: false })
        .limit(20)

      // Get available sensors
      const { data: recentTelemetry } = await supabase
        .from('device_telemetry_history')
        .select('telemetry')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(10)

      const uniqueSensors: string[] = []
      if (recentTelemetry && recentTelemetry.length > 0) {
        const sensorSet = new Set<string>()
        for (const record of recentTelemetry) {
          const telemetry = record.telemetry as Record<string, unknown>
          const extractSensorNames = (obj: Record<string, unknown>, prefix = ''): void => {
            for (const key in obj) {
              const value = obj[key]
              if (key === 'metadata' || key === 'location') continue
              if (typeof value === 'number' || (value && typeof value === 'object' && 'value' in value)) {
                sensorSet.add(prefix + key)
              } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                extractSensorNames(value as Record<string, unknown>, prefix)
              }
            }
          }
          extractSensorNames(telemetry)
        }
        uniqueSensors.push(...Array.from(sensorSet))
      }

      const responseData: SensorDetailsData = {
        device: {
          id: device.id,
          name: device.name,
          device_type: device.device_type,
          model: device.model || undefined,
          serial_number: device.serial_number || undefined,
          status: device.status || 'offline',
          location: device.location_id || undefined,
          firmware_version: device.firmware_version || undefined,
          battery_level: device.battery_level || undefined,
          signal_strength: device.signal_strength || undefined,
          last_seen: device.last_seen || undefined,
          metadata: (device.metadata && typeof device.metadata === 'object' ? device.metadata : undefined) as Record<string, unknown> | undefined,
        },
        sensor_type: selectedSensor,
        latest_reading: latestReading as SensorReading | null,
        trend_data: trendData || [],
        statistics,
        threshold: threshold as SensorThreshold | null,
        recent_activity: recentActivity as SensorActivity[],
        available_sensors: uniqueSensors,
      }

      setData(responseData)
    } catch (err) {
      console.error('Error fetching sensor data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load sensor data')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [currentOrganization, deviceId, selectedSensor, timeRange])

  useEffect(() => {
    fetchSensorData()
  }, [fetchSensorData])

  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-center p-12 border-2 border-dashed rounded-lg">
          <div className="text-center space-y-3">
            <p className="text-muted-foreground">No organization selected</p>
            <p className="text-sm text-muted-foreground">
              Please select an organization from the sidebar
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Loading sensor data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error Loading Sensor Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {error || 'Failed to load sensor data. Please try again.'}
            </p>
            <Button onClick={fetchSensorData}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">
              {data.device.name}
            </h1>
            <Badge variant={data.device.status === 'online' ? 'default' : 'secondary'}>
              {data.device.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.device.device_type} • {data.device.serial_number || 'No serial number'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sensor Type Selector */}
          <select
            value={selectedSensor}
            onChange={(e) => setSelectedSensor(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            {data.available_sensors.map((sensor) => (
              <option key={sensor} value={sensor}>
                {sensor.charAt(0).toUpperCase() + sensor.slice(1)}
              </option>
            ))}
          </select>

          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="48h">Last 48 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Overview Card */}
        <SensorOverviewCard
          latestReading={data.latest_reading}
          statistics={data.statistics}
          threshold={data.threshold}
          device={data.device}
          sensorType={selectedSensor}
        />

        {/* Trend Graph - Spans 2 columns */}
        <div className="md:col-span-2">
          <SensorTrendGraph
            data={data.trend_data}
            sensorType={selectedSensor}
            threshold={data.threshold}
            timeRange={timeRange}
          />
        </div>
      </div>

      {/* Activity Timeline - Stage 3 */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Activity timeline will be available in Stage 3
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
