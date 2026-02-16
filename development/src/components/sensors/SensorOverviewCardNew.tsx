'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Battery, Signal, Activity, Thermometer, Droplets } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Device } from '@/types/sensor-details'
import { TemperatureToggle } from '@/components/ui/temperature-toggle'

interface TelemetryReading {
  telemetry: {
    type?: number
    units?: number
    value?: number
    sensor?: string
    [key: string]: unknown
  }
  device_timestamp: string | null
  received_at: string
}

interface SensorOverviewCardProps {
  device: Device
  telemetryReadings: TelemetryReading[]
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

function getSensorIcon(sensorType?: number) {
  if (sensorType === 1) return Thermometer
  if (sensorType === 2) return Droplets
  return Activity
}

export function SensorOverviewCard({ device, telemetryReadings }: SensorOverviewCardProps) {
  const [useFahrenheit, setUseFahrenheit] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('temperatureUnit') === 'F'
    }
    return false
  })
  
  // Group latest readings by sensor type
  const latestBySensor = useMemo(() => {
    const grouped: Record<string, TelemetryReading> = {}
    
    for (const reading of telemetryReadings) {
      const sensorKey = reading.telemetry.type != null
        ? `type_${reading.telemetry.type}`
        : reading.telemetry.sensor || 'unknown'
      
      if (!grouped[sensorKey]) {
        grouped[sensorKey] = reading
      }
    }
    
    return Object.values(grouped)
  }, [telemetryReadings])

  // Get status badge color
  const getStatusBadge = () => {
    const status = device.status
    if (status === 'online') return { label: 'Online', variant: 'default' as const, icon: '🟢' }
    if (status === 'offline') return { label: 'Offline', variant: 'secondary' as const, icon: '⚫' }
    if (status === 'warning') return { label: 'Warning', variant: 'secondary' as const, icon: '🟡' }
    if (status === 'error') return { label: 'Error', variant: 'destructive' as const, icon: '🔴' }
    return { label: 'Unknown', variant: 'secondary' as const, icon: '⚪' }
  }

  const statusBadge = getStatusBadge()

  // Format time ago
  const formatTimeAgo = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'Never'
    const diff = Date.now() - new Date(timestamp).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  // Get most recent timestamp
  const lastReading = telemetryReadings[0]
  const lastReadingTime = lastReading?.device_timestamp || lastReading?.received_at

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">🔍 Sensor Overview</CardTitle>
          <div className="flex items-center gap-4">
            <TemperatureToggle
              useFahrenheit={useFahrenheit}
              onToggle={(value) => {
                setUseFahrenheit(value)
                if (typeof window !== 'undefined') {
                  localStorage.setItem('temperatureUnit', value ? 'F' : 'C')
                }
              }}
            />
            <Badge variant={statusBadge.variant}>
              {statusBadge.icon} {statusBadge.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Device Name & Type */}
        <div>
          <h3 className="text-2xl font-bold">{device.name}</h3>
          <p className="text-muted-foreground">{device.device_type}</p>
          {device.serial_number && (
            <p className="text-xs text-muted-foreground mt-1">S/N: {device.serial_number}</p>
          )}
        </div>

        {/* Last Reading Timestamp */}
        <div className="flex items-center justify-between py-3 border-y">
          <span className="text-sm font-medium">Last Reading:</span>
          <span className="text-sm text-muted-foreground">{formatTimeAgo(lastReadingTime)}</span>
        </div>

        {/* Current Sensor Values - Largest Font */}
        <div className="space-y-4">
          {latestBySensor.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No sensor data available</p>
          ) : (
            latestBySensor.map((reading, idx) => {
              const SensorIcon = getSensorIcon(reading.telemetry.type as number | undefined)
              const sensorLabel = reading.telemetry.type != null
                ? SENSOR_LABELS[reading.telemetry.type as number]
                : reading.telemetry.sensor || 'Sensor'
              let unit = reading.telemetry.units != null
                ? UNIT_LABELS[reading.telemetry.units as number]
                : ''
              let value = reading.telemetry.value != null
                ? Number(reading.telemetry.value)
                : null
              
              // Convert temperature if needed
              const isTemperature = reading.telemetry.type === 1 || unit === '°C' || unit === '°F'
              if (value !== null && isTemperature) {
                if (useFahrenheit && unit === '°C') {
                  value = (value * 9/5) + 32
                  unit = '°F'
                } else if (!useFahrenheit && unit === '°F') {
                  value = (value - 32) * 5/9
                  unit = '°C'
                }
              }
              
              const displayValue = value !== null ? value.toFixed(1) : 'N/A'

              return (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SensorIcon className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium">{sensorLabel}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">
                      {displayValue}
                      <span className="text-xl ml-1">{unit}</span>
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Secondary Info Grid */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          {/* Battery Level */}
          {device.battery_level != null && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Battery className="h-3 w-3" />
                <span>Battery</span>
              </div>
              <p className="text-lg font-semibold">{device.battery_level}%</p>
            </div>
          )}

          {/* Signal Strength */}
          {device.signal_strength != null && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Signal className="h-3 w-3" />
                <span>Signal</span>
              </div>
              <p className="text-lg font-semibold">{device.signal_strength} dBm</p>
            </div>
          )}

          {/* Last Telemetry */}
          {telemetryReadings.length > 0 && telemetryReadings[0].received_at && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span>Last Reading</span>
              </div>
              <p className="text-lg font-semibold">{formatTimeAgo(telemetryReadings[0].received_at)}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
