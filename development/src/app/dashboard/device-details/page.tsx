'use client'

// Cache bust: 2026-02-17 v4 - Use edge function for device fetch (multi-org support)
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { SensorOverviewCard } from '@/components/sensors/SensorOverviewCardNew'
import { GatewayOverviewCard } from '@/components/sensors/GatewayOverviewCard'
import { LocationDetailsCard } from '@/components/sensors/LocationDetailsCard'
import { DeviceHealthCard } from '@/components/sensors/DeviceHealthCard'
import { RecentActivityCard } from '@/components/sensors/RecentActivityCard'
import { AlertsThresholdsCard } from '@/components/sensors/AlertsThresholdsCard'
import { StatisticalSummaryCard } from '@/components/sensors/StatisticalSummaryCard'
import { HistoricalDataViewer } from '@/components/sensors/HistoricalDataViewer'
import type { Device } from '@/types/sensor-details'

/**
 * Determine if a device is a gateway/cellular type (not an environmental sensor)
 * Gateways don't produce temperature/humidity/pressure data - they relay data
 * from child sensors and report connectivity metrics instead.
 */
function isGatewayDevice(device: Device): boolean {
  const type = (device.device_type || '').toLowerCase()
  const name = (device.name || '').toLowerCase()
  const model = (device.model || '').toLowerCase()

  // Check device_type field
  if (
    type.includes('gateway') ||
    type.includes('cellular') ||
    type.includes('nrf9151') ||
    type.includes('nrf9160') ||
    type.includes('router') ||
    type.includes('hub') ||
    type === 'netneural-gateway' ||
    type === 'cellular-gateway' ||
    type === 'nrf9151_cellular'
  ) {
    return true
  }

  // Check device name
  if (name.includes('gateway') || name.includes('cellular')) {
    return true
  }

  // Check model
  if (model.includes('gateway') || model.includes('nrf9151') || model.includes('nrf9160')) {
    return true
  }

  // Check metadata
  if (device.metadata) {
    if (
      device.metadata.is_gateway === true ||
      device.metadata.isGateway === true ||
      (typeof device.metadata.device_category === 'string' && 
        device.metadata.device_category.toLowerCase().includes('gateway'))
    ) {
      return true
    }
  }

  return false
}

interface TelemetryReading {
  device_id: string
  telemetry: Record<string, unknown>
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
  const [temperatureUnit, setTemperatureUnit] = useState<'celsius' | 'fahrenheit'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('temperatureUnit')
      if (stored === 'C') return 'celsius'
    }
    return 'fahrenheit' // Default: Fahrenheit
  })

  // Determine device category
  const isGateway = useMemo(() => device ? isGatewayDevice(device) : false, [device])

  const fetchDeviceData = useCallback(async () => {
    if (!currentOrganization || !deviceId) return

    try {
      setLoading(true)
      setError(null)

      // Fetch device via edge function (bypasses RLS, supports multi-org)
      const deviceResponse = await edgeFunctions.devices.get(deviceId)
      
      if (!deviceResponse.success || !deviceResponse.data) {
        throw new Error('Device not found')
      }

      // The edge function returns { device: {...} }
      const deviceData = (deviceResponse.data as { device: Record<string, unknown> }).device
      if (!deviceData) throw new Error('Device not found')

      setDevice({
        id: deviceData.id as string,
        name: deviceData.name as string,
        device_type: (deviceData.device_type as string) || 'unknown',
        model: (deviceData.model as string) || undefined,
        serial_number: (deviceData.serial_number as string) || undefined,
        status: (deviceData.status as Device['status']) || 'offline',
        location: (deviceData.location as string) || undefined,
        location_id: (deviceData.location_id as string) || undefined,
        firmware_version: (deviceData.firmware_version as string) || undefined,
        battery_level: deviceData.battery_level != null ? (deviceData.battery_level as number) : undefined,
        signal_strength: deviceData.signal_strength != null ? (deviceData.signal_strength as number) : undefined,
        last_seen: (deviceData.last_seen as string) || undefined,
        metadata: deviceData.metadata as Record<string, unknown> | undefined,
        organization_id: deviceData.organization_id as string,
      })

      // Fetch telemetry readings (48 hours) - uses direct client (RLS allows via USING(true))
      const supabase = createClient()
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

      // Fetch temperature unit preference from any threshold
      const { data: thresholds } = await supabase
        .from('sensor_thresholds')
        .select('temperature_unit')
        .eq('device_id', deviceId)
        .limit(1)
      
      const thresholdsTyped = thresholds as Array<{ temperature_unit?: string }> | null
      const firstThreshold = thresholdsTyped?.[0]
      if (firstThreshold?.temperature_unit) {
        setTemperatureUnit(firstThreshold.temperature_unit as 'celsius' | 'fahrenheit')
      }

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

      {/* Priority Cards - Conditional by device type */}
      <div className="grid gap-6 md:grid-cols-1">
        {/* 1. Overview Card - Different for gateways vs sensors */}
        {isGateway ? (
          <GatewayOverviewCard device={device} telemetryReadings={telemetryReadings} />
        ) : (
          <SensorOverviewCard device={device} telemetryReadings={telemetryReadings} />
        )}

        {/* 2. Historical Data Viewer - Only for sensors with telemetry data */}
        {!isGateway && (
          <HistoricalDataViewer device={device} />
        )}

        {/* 3. Location + Health - Always shown */}
        <div className="grid gap-6 md:grid-cols-2">
          <LocationDetailsCard device={device} />
          <DeviceHealthCard device={device} telemetryReadings={telemetryReadings} />
        </div>

        {/* 4. Alerts + Activity - Alerts only for sensors */}
        <div className={`grid gap-6 ${isGateway ? 'md:grid-cols-1' : 'md:grid-cols-2'}`}>
          {!isGateway && (
            <AlertsThresholdsCard 
              device={device} 
              temperatureUnit={temperatureUnit}
              onTemperatureUnitChange={setTemperatureUnit}
            />
          )}
          <RecentActivityCard device={device} />
        </div>

        {/* 5. Statistics - Only for sensors */}
        {!isGateway && (
          <StatisticalSummaryCard 
            device={device} 
            telemetryReadings={telemetryReadings}
            temperatureUnit={temperatureUnit}
          />
        )}
      </div>
    </div>
  )
}


