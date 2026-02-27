'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Activity, Calendar } from 'lucide-react'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import type { Device } from '@/types/sensor-details'

interface DeviceSystemInfoTabProps {
  device: Device
}

export function DeviceSystemInfoTab({ device }: DeviceSystemInfoTabProps) {
  const { fmt } = useDateFormatter()

  return (
    <div className="space-y-4">
      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
          <CardDescription>Internal identifiers and timestamps</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primary Identifiers */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Primary Identifiers</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Device ID</p>
                <p className="break-all font-mono text-sm">{device.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Organization ID</p>
                <p className="break-all font-mono text-sm">{device.organization_id}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Related Entity IDs */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Related Entities</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {device.location_id && (
                <div>
                  <p className="text-sm text-muted-foreground">Location ID</p>
                  <p className="break-all font-mono text-sm">{device.location_id}</p>
                </div>
              )}
              {device.department_id && (
                <div>
                  <p className="text-sm text-muted-foreground">Department ID</p>
                  <p className="break-all font-mono text-sm">{device.department_id}</p>
                </div>
              )}
              {device.integration_id && (
                <div>
                  <p className="text-sm text-muted-foreground">Integration ID</p>
                  <p className="break-all font-mono text-sm">{device.integration_id}</p>
                </div>
              )}
              {device.external_device_id && (
                <div>
                  <p className="text-sm text-muted-foreground">External Device ID</p>
                  <p className="break-all font-mono text-sm">{device.external_device_id}</p>
                </div>
              )}
              {device.cohort_id && (
                <div>
                  <p className="text-sm text-muted-foreground">Cohort ID</p>
                  <p className="font-mono text-sm">{device.cohort_id}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Timestamps */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Timestamps</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {device.created_at && (
                <div>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Created At
                  </p>
                  <p className="text-sm font-medium">{fmt.dateTime(device.created_at)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{device.created_at}</p>
                </div>
              )}
              {device.updated_at && (
                <div>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Updated At
                  </p>
                  <p className="text-sm font-medium">{fmt.dateTime(device.updated_at)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{device.updated_at}</p>
                </div>
              )}
              {device.last_seen && (
                <div>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Activity className="h-3 w-3" /> Last Seen
                  </p>
                  <p className="text-sm font-medium">{fmt.dateTime(device.last_seen)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{device.last_seen}</p>
                </div>
              )}
              {device.last_seen_online && (
                <div>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Activity className="h-3 w-3" /> Last Seen Online
                  </p>
                  <p className="text-sm font-medium">{fmt.dateTime(device.last_seen_online)}</p>
                </div>
              )}
              {device.last_seen_offline && (
                <div>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Activity className="h-3 w-3" /> Last Seen Offline
                  </p>
                  <p className="text-sm font-medium">{fmt.dateTime(device.last_seen_offline)}</p>
                </div>
              )}
            </div>
          </div>

          {device.hardware_ids && device.hardware_ids.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Hardware Identifiers</h3>
                <div className="flex flex-wrap gap-2">
                  {device.hardware_ids.map((id, idx) => (
                    <Badge key={idx} variant="outline" className="font-mono text-xs">{id}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      {device.metadata && Object.keys(device.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Device Metadata</CardTitle>
            <CardDescription>Additional device properties and custom fields</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
              {JSON.stringify(device.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
