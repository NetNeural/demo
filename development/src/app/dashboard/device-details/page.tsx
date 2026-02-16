'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { SensorOverviewCard } from '@/components/sensors/SensorOverviewCardNew'
import { LocationDetailsCard } from '@/components/sensors/LocationDetailsCard'
import { DeviceHealthCard } from '@/components/sensors/DeviceHealthCard'
import { RecentActivityCard } from '@/components/sensors/RecentActivityCard'
import { AlertsThresholdsCard } from '@/components/sensors/AlertsThresholdsCard'
import { StatisticalSummaryCard } from '@/components/sensors/StatisticalSummaryCard'
import { HistoricalDataViewer } from '@/components/sensors/HistoricalDataViewer'
import type { Device } from '@/types/sensor-details'

interface TelemetryReading {
  device_id: string
  telemetry: any
  device_timestamp: string | null
  received_at: string
}

export default function SensorDetailsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOrganization } = useOrganization()
  const deviceId = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [device, setDevice] = useState<Device | null>(null)
  const [telemetryReadings, setTelemetryReadings] = useState<TelemetryReading[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchDeviceData = useCallback(async () => {
    if (!currentOrganization || !deviceId) return

    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()

      // Fetch device details
      const { data: deviceData, error: deviceError } = await supabase
        .from('devices')
        .select('*')
        .eq('id', deviceId)
        .eq('organization_id', currentOrganization.id)
        .single()

      if (deviceError) throw deviceError
      if (!deviceData) throw new Error('Device not found')

      setDevice({
        id: deviceData.id,
        name: deviceData.name,
        device_type: deviceData.device_type || 'unknown',
        model: deviceData.model || undefined,
        serial_number: deviceData.serial_number || undefined,
        status: deviceData.status || 'offline',
        location: deviceData.location_id || 'Unknown',
        firmware_version: deviceData.firmware_version || undefined,
        battery_level: deviceData.battery_level ?? undefined,
        signal_strength: deviceData.signal_strength ?? undefined,
        last_seen: deviceData.last_seen || undefined,
        metadata: deviceData.metadata as Record<string, any> | undefined,
      })

      // Fetch telemetry readings (48 hours)
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const { data: telemetryData, error: telemetryError } = await supabase
        .from('device_telemetry_history')
        .select('device_id, telemetry, device_timestamp, received_at')
        .eq('device_id', deviceId)
        .eq('organization_id', currentOrganization.id)
        .gte('received_at', fortyEightHoursAgo)
        .order('received_at', { ascending: false })
        .limit(500)

      if (telemetryError) throw telemetryError
      setTelemetryReadings((telemetryData as TelemetryReading[]) || [])

    } catch (err) {
      console.error('[SensorDetails] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load sensor data')
    } finally {
      setLoading(false)
    }
  }, [currentOrganization, deviceId])

  useEffect(() => {
    fetchDeviceData()
  }, [fetchDeviceData])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !device) {
    return (
      <div className="container mx-auto p-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/devices')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Devices
        </Button>
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error || 'Device not found'}</p>
          <Button onClick={fetchDeviceData}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/devices')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{device.name}</h1>
            <p className="text-muted-foreground">{device.device_type}</p>
          </div>
        </div>
      </div>

      {/* Priority Cards */}
      <div className="grid gap-6 md:grid-cols-1">
        {/* 1. Sensor Overview */}
        <SensorOverviewCard device={device} telemetryReadings={telemetryReadings} />

        {/* 2. Historical Data Viewer with Trend Chart */}
        <HistoricalDataViewer device={device} />

        {/* 3. Location + Health */}
        <div className="grid gap-6 md:grid-cols-2">
          <LocationDetailsCard device={device} />
          <DeviceHealthCard device={device} telemetryReadings={telemetryReadings} />
        </div>

        {/* 4. Alerts + Activity */}
        <div className="grid gap-6 md:grid-cols-2">
          <AlertsThresholdsCard device={device} telemetryReadings={telemetryReadings} />
          <RecentActivityCard device={device} />
        </div>

        {/* 5. Statistics */}
        <StatisticalSummaryCard device={device} telemetryReadings={telemetryReadings} />
      </div>
    </div>
  )
}


