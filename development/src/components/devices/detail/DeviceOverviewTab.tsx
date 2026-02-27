'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { SensorOverviewCard } from '@/components/sensors/SensorOverviewCardNew'
import { GatewayOverviewCard } from '@/components/sensors/GatewayOverviewCard'
import { LocationDetailsCard } from '@/components/sensors/LocationDetailsCard'
import { DeviceHealthCard } from '@/components/sensors/DeviceHealthCard'
import { InheritedConfigCard } from '@/components/device-types/InheritedConfigCard'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import type { Device, TelemetryReading } from '@/types/sensor-details'

interface DeviceOverviewTabProps {
  device: Device
  telemetryReadings: TelemetryReading[]
  isGateway: boolean
}

export function DeviceOverviewTab({ device, telemetryReadings, isGateway }: DeviceOverviewTabProps) {
  const { fmt } = useDateFormatter()

  return (
    <div className="space-y-6">
      {/* Sensor / Gateway Overview Card */}
      {isGateway ? (
        <GatewayOverviewCard device={device} telemetryReadings={telemetryReadings} />
      ) : (
        <SensorOverviewCard device={device} telemetryReadings={telemetryReadings} />
      )}

      {/* Device Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Device Information</CardTitle>
          <CardDescription>Comprehensive device details and specifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="mb-3 text-lg font-semibold">Basic Information</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {device.name && (
                <div>
                  <p className="text-sm text-muted-foreground">Device Name</p>
                  <p className="font-medium">{device.name}</p>
                </div>
              )}
              {device.device_type && (
                <div>
                  <p className="text-sm text-muted-foreground">Device Type</p>
                  <p className="font-medium">{device.device_type}</p>
                </div>
              )}
              {device.model && (
                <div>
                  <p className="text-sm text-muted-foreground">Model</p>
                  <p className="font-medium">{device.model}</p>
                </div>
              )}
              {device.serial_number && (
                <div>
                  <p className="text-sm text-muted-foreground">Serial Number</p>
                  <p className="font-mono text-sm">{device.serial_number}</p>
                </div>
              )}
              {device.firmware_version && (
                <div>
                  <p className="text-sm text-muted-foreground">Firmware Version</p>
                  <p className="font-medium">{device.firmware_version}</p>
                </div>
              )}
              {device.location && (
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{device.location}</p>
                </div>
              )}
              {device.cohort_id && (
                <div>
                  <p className="text-sm text-muted-foreground">Cohort ID</p>
                  <p className="font-mono text-sm">{device.cohort_id}</p>
                </div>
              )}
              {device.hardware_ids && device.hardware_ids.length > 0 && (
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Hardware IDs</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {device.hardware_ids.map((id, idx) => (
                      <Badge key={idx} variant="outline" className="font-mono text-xs">{id}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {device.device_type_id && (
            <>
              <Separator />
              <InheritedConfigCard deviceTypeId={device.device_type_id} />
            </>
          )}

          <Separator />

          {/* Connection & Activity */}
          <div>
            <h3 className="mb-3 text-lg font-semibold">Connection & Activity</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {device.status && (
                <div>
                  <p className="text-sm text-muted-foreground">Current Status</p>
                  <Badge
                    variant={
                      device.status === 'online' ? 'default'
                        : device.status === 'warning' ? 'secondary'
                        : device.status === 'error' ? 'destructive'
                        : 'outline'
                    }
                    className="mt-1"
                  >
                    {device.status.toUpperCase()}
                  </Badge>
                </div>
              )}
              {device.last_seen && (
                <div>
                  <p className="text-sm text-muted-foreground">Last Seen</p>
                  <p className="font-medium">{fmt.dateTime(device.last_seen)}</p>
                </div>
              )}
              {device.battery_level != null && (
                <div>
                  <p className="text-sm text-muted-foreground">Battery Level</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary" role="progressbar"
                      aria-label={`Battery level ${device.battery_level}%`}>
                      <div
                        className={`h-full transition-all ${device.battery_level > 50 ? 'bg-green-500' : device.battery_level > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${device.battery_level}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{device.battery_level}%</span>
                  </div>
                </div>
              )}
              {device.signal_strength != null && (
                <div>
                  <p className="text-sm text-muted-foreground">Signal Strength</p>
                  <p className="font-medium">{device.signal_strength} dBm</p>
                </div>
              )}
            </div>
          </div>

          {/* Integration Information */}
          {(device.is_externally_managed || device.integration_id) && (
            <>
              <Separator />
              <div>
                <h3 className="mb-3 text-lg font-semibold">Integration</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {device.integration_name && (
                    <div>
                      <p className="text-sm text-muted-foreground">Integration Name</p>
                      <p className="font-medium">{device.integration_name}</p>
                    </div>
                  )}
                  {device.integration_type && (
                    <div>
                      <p className="text-sm text-muted-foreground">Integration Type</p>
                      <p className="font-medium">{device.integration_type}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {device.description && (
            <>
              <Separator />
              <div>
                <h3 className="mb-3 text-lg font-semibold">Description</h3>
                <p className="text-sm text-muted-foreground">{device.description}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Location + Health */}
      <div className="grid gap-6 md:grid-cols-2">
        <LocationDetailsCard device={device} />
        <DeviceHealthCard device={device} telemetryReadings={telemetryReadings} />
      </div>
    </div>
  )
}
