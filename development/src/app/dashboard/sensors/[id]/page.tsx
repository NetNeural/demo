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
import type { SensorDetailsData, TimeRange } from '@/types/sensor-details'

// Required for static export with dynamic routes
// Returns empty array since device IDs are dynamic and fetched at runtime
export function generateStaticParams() {
  return []
}

export default function SensorDetailsPage() {
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

      // NOTE: This endpoint doesn't exist yet - we'll create it in Stage 1
      const response = await fetch(
        `/api/sensors/${deviceId}?sensor_type=${selectedSensor}&time_range=${timeRange}`,
        {
          headers: {
            'x-organization-id': currentOrganization.id,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch sensor data')
      }

      const result = await response.json()
      setData(result.data)
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
