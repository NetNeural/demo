'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Battery, Signal, HardDrive, Clock } from 'lucide-react'
import type { Device } from '@/types/sensor-details'
import { useDateFormatter } from '@/hooks/useDateFormatter'

interface TelemetryReading {
  device_id: string
  telemetry: {
    type?: number
    [key: string]: unknown
  } | null
  device_timestamp: string | null
  received_at: string
}

interface DeviceHealthCardProps {
  device: Device
  telemetryReadings?: TelemetryReading[]
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

export function DeviceHealthCard({ device, telemetryReadings = [] }: DeviceHealthCardProps) {
  const { fmt } = useDateFormatter()

  // Get last timestamp for each sensor type
  const getLastTelemetryTimestamps = () => {
    const sensorTimestamps: Record<string, string> = {}
    
    telemetryReadings.forEach(reading => {
      const sensorType = reading.telemetry?.type
      
      if (sensorType === undefined) return
      
      const label = SENSOR_LABELS[sensorType]
      
      if (label && !sensorTimestamps[label]) {
        // Use device_timestamp if available, otherwise received_at
        sensorTimestamps[label] = reading.device_timestamp || reading.received_at
      }
    })
    
    return sensorTimestamps
  }

  const sensorTimestamps = getLastTelemetryTimestamps()

  const getBatteryIcon = () => {
    if (!device.battery_level) return '🔋'
    if (device.battery_level > 75) return '🔋'
    if (device.battery_level > 25) return '🔋'
    return '🪫'
  }

  const getSignalIcon = () => {
    if (!device.signal_strength) return '📶'
    if (device.signal_strength > -60) return '📶'
    if (device.signal_strength > -80) return '📶'
    return '📵'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          ⚙️ Device Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Last Telemetry Readings */}
        {Object.keys(sensorTimestamps).length > 0 ? (
          <div className="space-y-3 pb-3 border-b">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last Telemetry Readings
            </div>
            {Object.entries(sensorTimestamps).map(([sensor, timestamp]) => (
              <div key={sensor} className="flex items-center justify-between pl-6">
                <span className="text-sm">{sensor}</span>
                <div className="text-right">
                  <div className="font-medium text-sm">{fmt.timeAgo(timestamp)}</div>
                  <div className="text-xs text-muted-foreground">{fmt.shortDateTime(timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between pb-3 border-b">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Last Telemetry</span>
            </div>
            <span className="font-medium text-muted-foreground">No data</span>
          </div>
        )}

        {/* Battery */}
        {device.battery_level != null && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Battery className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Battery</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{device.battery_level}%</span>
              <span>{getBatteryIcon()}</span>
            </div>
          </div>
        )}

        {/* Signal */}
        {device.signal_strength != null && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Signal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Signal</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{device.signal_strength} dBm</span>
              <span>{getSignalIcon()}</span>
            </div>
          </div>
        )}

        {/* Firmware */}
        {device.firmware_version && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Firmware</span>
            </div>
            <Badge variant="secondary">{device.firmware_version}</Badge>
          </div>
        )}

        {/* Model */}
        {device.model && (
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Model</span>
            <span className="font-medium">{device.model}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
