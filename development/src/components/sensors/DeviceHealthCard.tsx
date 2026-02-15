'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Battery, Signal, HardDrive } from 'lucide-react'
import type { Device } from '@/types/sensor-details'

interface DeviceHealthCardProps {
  device: Device
}

export function DeviceHealthCard({ device }: DeviceHealthCardProps) {
  const calculateUptime = () => {
    if (!device.last_seen) return 'Unknown'
    const now = Date.now()
    const lastSeen = new Date(device.last_seen).getTime()
    const diffMs = now - lastSeen
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
    const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    const mins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000))
    return `${days}d ${hours}h ${mins}m`
  }

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
        {/* Uptime */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Uptime</span>
          </div>
          <span className="font-medium">{calculateUptime()}</span>
        </div>

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
