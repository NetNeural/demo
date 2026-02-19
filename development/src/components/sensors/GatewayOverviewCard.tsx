'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Radio, 
  Signal, 
  Battery, 
  Wifi, 
  Clock, 
  Activity,
  Server,
  ArrowUpDown,
} from 'lucide-react'
import { useMemo } from 'react'
import type { Device } from '@/types/sensor-details'
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

interface GatewayOverviewCardProps {
  device: Device
  telemetryReadings: TelemetryReading[]
}

/**
 * Gateway Overview Card
 * Displays connectivity metrics relevant to cellular gateways:
 * - Connection status and uptime
 * - Signal strength (RSSI/RSRP)
 * - Battery level
 * - Firmware version
 * - Last communication timestamp
 * - Gateway metadata (ICCID, IMEI, carrier, etc.)
 */
export function GatewayOverviewCard({ device, telemetryReadings }: GatewayOverviewCardProps) {
  const { fmt } = useDateFormatter()

  // Get status badge
  const getStatusBadge = () => {
    const status = device.status
    if (status === 'online') return { label: 'Connected', variant: 'default' as const, icon: '🟢' }
    if (status === 'offline') return { label: 'Disconnected', variant: 'secondary' as const, icon: '⚫' }
    if (status === 'warning') return { label: 'Degraded', variant: 'secondary' as const, icon: '🟡' }
    if (status === 'error') return { label: 'Error', variant: 'destructive' as const, icon: '🔴' }
    return { label: 'Unknown', variant: 'secondary' as const, icon: '⚪' }
  }

  const statusBadge = getStatusBadge()

  // Calculate uptime from last_seen
  const uptimeDisplay = useMemo(() => {
    if (!device.last_seen) return null
    const lastSeen = new Date(device.last_seen)
    const now = new Date()
    const diffMs = now.getTime() - lastSeen.getTime()
    
    // If last seen within 15 minutes, consider "active"
    if (diffMs < 15 * 60 * 1000) {
      return 'Active'
    }
    return fmt.timeAgo(device.last_seen)
  }, [device.last_seen, fmt])

  // Extract gateway-specific metadata
  const gatewayMeta = useMemo(() => {
    const meta = device.metadata || {}
    return {
      iccid: meta.iccid as string || meta.ICCID as string || null,
      imei: meta.imei as string || meta.IMEI as string || null,
      carrier: meta.carrier as string || meta.network_operator as string || null,
      connectionType: meta.connection_type as string || meta.rat as string || null,
      ipAddress: meta.ip_address as string || meta.ip as string || null,
      band: meta.band as string || meta.frequency_band as string || null,
      childDeviceCount: meta.child_device_count as number || meta.connected_devices as number || null,
    }
  }, [device.metadata])

  // Get signal quality description
  const getSignalQuality = (dbm: number | undefined) => {
    if (dbm == null) return { label: 'Unknown', color: 'text-muted-foreground' }
    if (dbm >= -65) return { label: 'Excellent', color: 'text-green-600' }
    if (dbm >= -75) return { label: 'Good', color: 'text-green-500' }
    if (dbm >= -85) return { label: 'Fair', color: 'text-yellow-500' }
    if (dbm >= -95) return { label: 'Poor', color: 'text-orange-500' }
    return { label: 'Very Poor', color: 'text-red-500' }
  }

  // Get battery status
  const getBatteryStatus = (level: number | undefined) => {
    if (level == null) return { label: 'Unknown', color: 'text-muted-foreground' }
    if (level >= 75) return { label: 'Good', color: 'text-green-600' }
    if (level >= 50) return { label: 'Moderate', color: 'text-yellow-500' }
    if (level >= 25) return { label: 'Low', color: 'text-orange-500' }
    return { label: 'Critical', color: 'text-red-500' }
  }

  const signalQuality = getSignalQuality(device.signal_strength)
  const batteryStatus = getBatteryStatus(device.battery_level)

  // Count telemetry readings received
  const readingCount = telemetryReadings.length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <Radio className="h-5 w-5 text-blue-500" />
            Gateway Overview
          </CardTitle>
          <Badge variant={statusBadge.variant}>
            {statusBadge.icon} {statusBadge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Device Identity */}
        <div>
          <h3 className="text-2xl font-bold">{device.name}</h3>
          <p className="text-muted-foreground">{device.device_type}</p>
          {device.serial_number && (
            <p className="text-xs text-muted-foreground mt-1">S/N: {device.serial_number}</p>
          )}
          {device.model && (
            <p className="text-xs text-muted-foreground">Model: {device.model}</p>
          )}
        </div>

        {/* Last Communication */}
        <div className="flex items-center justify-between py-3 border-y">
          <span className="text-sm font-medium">Last Communication:</span>
          <span className="text-sm text-muted-foreground">{fmt.timeAgo(device.last_seen)}</span>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Signal Strength */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Signal className="h-4 w-4" />
              <span>Signal Strength</span>
            </div>
            {device.signal_strength != null ? (
              <>
                <p className="text-2xl font-bold">{device.signal_strength} <span className="text-sm font-normal">dBm</span></p>
                <p className={`text-xs font-medium ${signalQuality.color}`}>{signalQuality.label}</p>
              </>
            ) : (
              <p className="text-lg text-muted-foreground">N/A</p>
            )}
          </div>

          {/* Battery Level */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Battery className="h-4 w-4" />
              <span>Battery Level</span>
            </div>
            {device.battery_level != null ? (
              <>
                <p className="text-2xl font-bold">{device.battery_level}<span className="text-sm font-normal">%</span></p>
                <p className={`text-xs font-medium ${batteryStatus.color}`}>{batteryStatus.label}</p>
              </>
            ) : (
              <p className="text-lg text-muted-foreground">N/A</p>
            )}
          </div>

          {/* Connection Status */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Wifi className="h-4 w-4" />
              <span>Connection</span>
            </div>
            <p className="text-lg font-bold">
              {device.status === 'online' ? (
                <span className="text-green-600">Active</span>
              ) : (
                <span className="text-muted-foreground">Inactive</span>
              )}
            </p>
            {uptimeDisplay && (
              <p className="text-xs text-muted-foreground">{uptimeDisplay}</p>
            )}
          </div>

          {/* Firmware */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Server className="h-4 w-4" />
              <span>Firmware</span>
            </div>
            <p className="text-lg font-bold truncate">
              {device.firmware_version || <span className="text-muted-foreground">Unknown</span>}
            </p>
          </div>
        </div>

        {/* Cellular/Network Details */}
        {(gatewayMeta.carrier || gatewayMeta.connectionType || gatewayMeta.imei || gatewayMeta.iccid) && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              Network Details
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {gatewayMeta.carrier && (
                <div>
                  <span className="text-xs text-muted-foreground">Carrier</span>
                  <p className="font-medium">{gatewayMeta.carrier}</p>
                </div>
              )}
              {gatewayMeta.connectionType && (
                <div>
                  <span className="text-xs text-muted-foreground">Type</span>
                  <p className="font-medium">{gatewayMeta.connectionType}</p>
                </div>
              )}
              {gatewayMeta.band && (
                <div>
                  <span className="text-xs text-muted-foreground">Band</span>
                  <p className="font-medium">{gatewayMeta.band}</p>
                </div>
              )}
              {gatewayMeta.ipAddress && (
                <div>
                  <span className="text-xs text-muted-foreground">IP Address</span>
                  <p className="font-medium font-mono text-xs">{gatewayMeta.ipAddress}</p>
                </div>
              )}
              {gatewayMeta.imei && (
                <div>
                  <span className="text-xs text-muted-foreground">IMEI</span>
                  <p className="font-medium font-mono text-xs">{gatewayMeta.imei}</p>
                </div>
              )}
              {gatewayMeta.iccid && (
                <div>
                  <span className="text-xs text-muted-foreground">ICCID</span>
                  <p className="font-medium font-mono text-xs">{gatewayMeta.iccid}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Telemetry Activity Summary */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Telemetry (48h)</span>
            </div>
            <span className="font-medium">{readingCount} readings</span>
          </div>
          {gatewayMeta.childDeviceCount != null && (
            <div className="flex items-center justify-between text-sm mt-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Connected Devices</span>
              </div>
              <span className="font-medium">{gatewayMeta.childDeviceCount}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
