'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Battery, Signal, Activity, Thermometer, Droplets } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Device } from '@/types/sensor-details'
import { TemperatureToggle } from '@/components/ui/temperature-toggle'
import { useDateFormatter } from '@/hooks/useDateFormatter'

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

export function SensorOverviewCard({
  device,
  telemetryReadings,
}: SensorOverviewCardProps) {
  const [useFahrenheit, setUseFahrenheit] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('temperatureUnit')
      return stored ? stored === 'F' : true // Default: Fahrenheit
    }
    return true
  })

  // Extract health metrics from latest telemetry reading
  const telemetryHealthMetrics = useMemo(() => {
    if (!telemetryReadings.length || !telemetryReadings[0]) return null

    const latest = telemetryReadings[0].telemetry
    return {
      battery: typeof latest.battery === 'number' ? latest.battery : null,
      rssi: typeof latest.rssi === 'number' ? latest.rssi : null,
      uptime: typeof latest.uptime === 'number' ? latest.uptime : null,
      firmware:
        typeof latest.firmware_version === 'string'
          ? latest.firmware_version
          : null,
    }
  }, [telemetryReadings])

  // Format uptime (seconds -> "3d 14h 23m")
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    const parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`)

    return parts.join(' ')
  }

  // Group last 5 readings by sensor type
  const latestBySensor = useMemo(() => {
    const grouped: Record<string, TelemetryReading[]> = {}

    for (const reading of telemetryReadings) {
      const sensorKey =
        reading.telemetry.type != null
          ? `type_${reading.telemetry.type}`
          : reading.telemetry.sensor || 'unknown'

      if (!grouped[sensorKey]) {
        grouped[sensorKey] = []
      }

      // Keep only the last 5 readings per sensor
      if (grouped[sensorKey].length < 5) {
        grouped[sensorKey].push(reading)
      }
    }

    return grouped
  }, [telemetryReadings])

  // Calculate min/max for all sensor data
  const sensorMinMax = useMemo(() => {
    const stats: Record<
      string,
      {
        min: number
        max: number
        minTime: string
        maxTime: string
        label: string
        unit: string
        isTemperature: boolean
      }
    > = {}

    for (const reading of telemetryReadings) {
      const sensorKey =
        reading.telemetry.type != null
          ? `type_${reading.telemetry.type}`
          : reading.telemetry.sensor || 'unknown'

      const value = reading.telemetry.value
      if (typeof value !== 'number') continue

      const timestamp = reading.device_timestamp || reading.received_at
      const sensorLabel =
        reading.telemetry.type != null
          ? SENSOR_LABELS[reading.telemetry.type as number] || 'Sensor'
          : reading.telemetry.sensor || 'Sensor'
      const unit =
        reading.telemetry.units != null
          ? UNIT_LABELS[reading.telemetry.units as number] || ''
          : ''
      const isTemperature =
        reading.telemetry.type === 1 || unit === '°C' || unit === '°F'

      if (!stats[sensorKey]) {
        stats[sensorKey] = {
          min: value,
          max: value,
          minTime: timestamp,
          maxTime: timestamp,
          label: sensorLabel,
          unit,
          isTemperature,
        }
      } else {
        if (value < stats[sensorKey].min) {
          stats[sensorKey].min = value
          stats[sensorKey].minTime = timestamp
        }
        if (value > stats[sensorKey].max) {
          stats[sensorKey].max = value
          stats[sensorKey].maxTime = timestamp
        }
      }
    }

    return stats
  }, [telemetryReadings])

  // Get status badge color
  const getStatusBadge = () => {
    const status = device.status
    if (status === 'online')
      return { label: 'Online', variant: 'default' as const, icon: '🟢' }
    if (status === 'offline')
      return { label: 'Offline', variant: 'secondary' as const, icon: '⚫' }
    if (status === 'warning')
      return { label: 'Warning', variant: 'secondary' as const, icon: '🟡' }
    if (status === 'error')
      return { label: 'Error', variant: 'destructive' as const, icon: '🔴' }
    return { label: 'Unknown', variant: 'secondary' as const, icon: '⚪' }
  }

  const statusBadge = getStatusBadge()
  const { fmt } = useDateFormatter()

  // Get most recent timestamp
  const lastReading = telemetryReadings[0]
  const lastReadingTime =
    lastReading?.device_timestamp || lastReading?.received_at

  // Format sensor value with temperature conversion
  const formatSensorValue = (reading: TelemetryReading) => {
    const value = reading.telemetry.value
    const sensorType = reading.telemetry.type
    const units = reading.telemetry.units

    if (typeof value !== 'number') return value

    // Temperature conversion
    if (sensorType === 1) {
      // Celsius to Fahrenheit
      const displayValue = useFahrenheit ? (value * 9) / 5 + 32 : value
      const unit = useFahrenheit ? '°F' : '°C'
      return `${displayValue.toFixed(2)} ${unit}`
    }

    // Other sensors
    const unit = units != null ? UNIT_LABELS[units] || '' : ''
    return `${value.toFixed(2)} ${unit}`
  }

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
            <p className="mt-1 text-xs text-muted-foreground">
              S/N: {device.serial_number}
            </p>
          )}
        </div>

        {/* Current Sensor Values - Largest Font */}
        <div className="space-y-4">
          {Object.keys(latestBySensor).length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No sensor data available
            </p>
          ) : (
            Object.entries(latestBySensor).map(([sensorKey, readings]) => {
              const reading = readings[0] // Get the most recent reading
              if (!reading) return null

              const SensorIcon = getSensorIcon(
                reading.telemetry.type as number | undefined
              )
              const sensorLabel =
                reading.telemetry.type != null
                  ? SENSOR_LABELS[reading.telemetry.type as number]
                  : reading.telemetry.sensor || 'Sensor'
              let unit =
                reading.telemetry.units != null
                  ? UNIT_LABELS[reading.telemetry.units as number]
                  : ''
              let value =
                reading.telemetry.value != null
                  ? Number(reading.telemetry.value)
                  : null

              // Convert temperature if needed
              const isTemperature =
                reading.telemetry.type === 1 || unit === '°C' || unit === '°F'
              if (value !== null && isTemperature) {
                if (useFahrenheit && unit === '°C') {
                  value = (value * 9) / 5 + 32
                  unit = '°F'
                } else if (!useFahrenheit && unit === '°F') {
                  value = ((value - 32) * 5) / 9
                  unit = '°C'
                }
              }

              const displayValue = value !== null ? value.toFixed(1) : 'N/A'

              const readingTime =
                reading.device_timestamp || reading.received_at

              return (
                <div
                  key={sensorKey}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <SensorIcon className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium">{sensorLabel}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">
                      {displayValue}
                      <span className="ml-1 text-xl">{unit}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {fmt.timeAgo(readingTime)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Secondary Info Grid - Device Health Metrics */}
        <div className="grid grid-cols-2 gap-4 pt-4">
          {/* Battery Level - Show both device profile and telemetry */}
          {(device.battery_level != null ||
            telemetryHealthMetrics?.battery != null) && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Battery className="h-3 w-3" />
                <span>Battery</span>
              </div>
              {device.battery_level != null && (
                <p className="text-lg font-semibold">
                  {device.battery_level}%
                  <span className="ml-1 text-xs text-muted-foreground">
                    (Profile)
                  </span>
                </p>
              )}
              {telemetryHealthMetrics?.battery != null && (
                <p className="text-sm text-muted-foreground">
                  {telemetryHealthMetrics.battery}%{' '}
                  <span className="text-xs">(Live)</span>
                </p>
              )}
              {device.battery_level == null &&
                telemetryHealthMetrics?.battery != null && (
                  <p className="text-lg font-semibold">
                    {telemetryHealthMetrics.battery}%
                  </p>
                )}
            </div>
          )}

          {/* Signal Strength - Show both device profile and telemetry */}
          {(device.signal_strength != null ||
            telemetryHealthMetrics?.rssi != null) && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Signal className="h-3 w-3" />
                <span>Signal</span>
              </div>
              {device.signal_strength != null && (
                <p className="text-lg font-semibold">
                  {device.signal_strength} dBm
                  <span className="ml-1 text-xs text-muted-foreground">
                    (Profile)
                  </span>
                </p>
              )}
              {telemetryHealthMetrics?.rssi != null && (
                <p className="text-sm text-muted-foreground">
                  {telemetryHealthMetrics.rssi} dBm{' '}
                  <span className="text-xs">(Live)</span>
                </p>
              )}
              {device.signal_strength == null &&
                telemetryHealthMetrics?.rssi != null && (
                  <p className="text-lg font-semibold">
                    {telemetryHealthMetrics.rssi} dBm
                  </p>
                )}
            </div>
          )}

          {/* Uptime - From telemetry only */}
          {telemetryHealthMetrics?.uptime != null && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span>Uptime</span>
              </div>
              <p className="text-lg font-semibold">
                {formatUptime(telemetryHealthMetrics.uptime)}
              </p>
            </div>
          )}

          {/* Firmware Version - Show both device profile and telemetry if different */}
          {(device.firmware_version || telemetryHealthMetrics?.firmware) && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span>Firmware</span>
              </div>
              {device.firmware_version && (
                <p className="text-lg font-semibold">
                  {device.firmware_version}
                  {telemetryHealthMetrics?.firmware &&
                    telemetryHealthMetrics.firmware !==
                      device.firmware_version && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (Profile)
                      </span>
                    )}
                </p>
              )}
              {telemetryHealthMetrics?.firmware &&
                telemetryHealthMetrics.firmware !== device.firmware_version && (
                  <p className="text-sm text-muted-foreground">
                    {telemetryHealthMetrics.firmware}{' '}
                    <span className="text-xs">(Live)</span>
                  </p>
                )}
              {!device.firmware_version && telemetryHealthMetrics?.firmware && (
                <p className="text-lg font-semibold">
                  {telemetryHealthMetrics.firmware}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Last 5 Readings Section */}
        <div className="border-y py-3">
          <span className="text-sm font-medium">Last 5 Readings:</span>
        </div>
        <div className="space-y-3">
          {Object.entries(latestBySensor).map(([sensorKey, readings]) => {
            const firstReading = readings[0]
            if (!firstReading) return null

            const sensorType = firstReading.telemetry.type
            const sensorLabel = sensorType
              ? SENSOR_LABELS[sensorType]
              : 'Reading'
            const Icon = getSensorIcon(sensorType)

            return (
              <div key={sensorKey} className="mb-3 last:mb-0">
                <div className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  <span>{sensorLabel}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {readings.map((reading, idx) => {
                    const value = reading.telemetry?.value
                    if (value == null) return null

                    return (
                      <div key={idx} className="flex flex-col">
                        <span className="text-sm font-medium">
                          {formatSensorValue(reading)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {fmt.timeAgo(reading.received_at)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Min/Max Readings */}
        {Object.keys(sensorMinMax).length > 0 && (
          <div className="space-y-3 border-t py-3">
            <span className="text-sm font-medium">All-Time Readings:</span>
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(sensorMinMax).map(([sensorKey, stats]) => {
                const typeId = sensorKey.startsWith('type_')
                  ? sensorKey.split('_')[1]
                  : undefined
                const SensorIcon = getSensorIcon(
                  typeId ? parseInt(typeId) : undefined
                )

                // Convert temperature if needed
                let minValue = stats.min
                let maxValue = stats.max
                let unit = stats.unit

                if (stats.isTemperature) {
                  if (useFahrenheit && unit === '°C') {
                    minValue = (minValue * 9) / 5 + 32
                    maxValue = (maxValue * 9) / 5 + 32
                    unit = '°F'
                  } else if (!useFahrenheit && unit === '°F') {
                    minValue = ((minValue - 32) * 5) / 9
                    maxValue = ((maxValue - 32) * 5) / 9
                    unit = '°C'
                  }
                }

                return (
                  <div
                    key={sensorKey}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <SensorIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {stats.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div>
                          <span className="text-xs text-muted-foreground">
                            Low:{' '}
                          </span>
                          <span className="font-medium text-blue-600">
                            {minValue.toFixed(1)} {unit}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {fmt.timeAgo(stats.minTime)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div>
                          <span className="text-xs text-muted-foreground">
                            High:{' '}
                          </span>
                          <span className="font-medium text-red-600">
                            {maxValue.toFixed(1)} {unit}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {fmt.timeAgo(stats.maxTime)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
