/**
 * Inherited Device Type Config Card
 *
 * Displays the inherited configuration from a device's assigned device type.
 * Shows normal range, alert thresholds, unit, class, and precision.
 * Read-only — values come from the device type, not the device itself.
 *
 * @see Issue #119
 */
'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Info, ArrowRight, Gauge, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useDeviceTypeQuery } from '@/hooks/queries/useDeviceTypes'
import { DEVICE_CLASSES } from '@/types/device-types'

interface InheritedConfigCardProps {
  deviceTypeId: string | null | undefined
}

function fmt(
  value: number | null | undefined,
  precision: number | null
): string {
  if (value == null) return '—'
  return value.toFixed(precision ?? 2)
}

function getClassLabel(deviceClass: string | null): string {
  if (!deviceClass) return ''
  return (
    DEVICE_CLASSES.find((c) => c.value === deviceClass)?.label ?? deviceClass
  )
}

export function InheritedConfigCard({
  deviceTypeId,
}: InheritedConfigCardProps) {
  const { data: deviceType, isLoading } = useDeviceTypeQuery(
    deviceTypeId ?? undefined
  )

  if (!deviceTypeId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4" />
            Device Type Configuration
          </CardTitle>
          <CardDescription>
            No device type assigned. Assign a device type to inherit monitoring
            configuration.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (isLoading || !deviceType) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4" />
            Device Type Configuration
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const p = deviceType.precision_digits

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4" />
              Inherited from: {deviceType.name}
            </CardTitle>
            {deviceType.description && (
              <CardDescription>{deviceType.description}</CardDescription>
            )}
          </div>
          <Link
            href="/dashboard/device-types"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Edit Type <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metadata row */}
        <div className="flex flex-wrap gap-2">
          {deviceType.device_class && (
            <Badge variant="secondary">
              {getClassLabel(deviceType.device_class)}
            </Badge>
          )}
          {deviceType.unit && (
            <Badge variant="outline" className="font-mono">
              {deviceType.unit}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {p} decimal{p !== 1 ? 's' : ''}
          </Badge>
        </div>

        <Separator />

        {/* Normal Range */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <div className="h-3 w-3 rounded-full border border-green-500 bg-green-500/30" />
            Normal Operating Range
          </div>
          <div className="flex items-center gap-2 pl-5 text-sm">
            <span className="font-mono">{fmt(deviceType.lower_normal, p)}</span>
            <span className="text-muted-foreground">to</span>
            <span className="font-mono">{fmt(deviceType.upper_normal, p)}</span>
            {deviceType.unit && (
              <span className="text-muted-foreground">{deviceType.unit}</span>
            )}
          </div>
        </div>

        {/* Alert Thresholds */}
        {(deviceType.lower_alert != null || deviceType.upper_alert != null) && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-3 w-3 text-destructive" />
              Alert Thresholds
            </div>
            <div className="grid grid-cols-2 gap-4 pl-5 text-sm">
              <div>
                <span className="text-muted-foreground">Critical Low: </span>
                <span className="font-mono">
                  {fmt(deviceType.lower_alert, p)}
                </span>
                {deviceType.unit && (
                  <span className="text-muted-foreground">
                    {' '}
                    {deviceType.unit}
                  </span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Critical High: </span>
                <span className="font-mono">
                  {fmt(deviceType.upper_alert, p)}
                </span>
                {deviceType.unit && (
                  <span className="text-muted-foreground">
                    {' '}
                    {deviceType.unit}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Inheritance note */}
        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>
            These values are inherited from the device type and apply to all
            devices of this type. Changes to the device type automatically
            propagate to all assigned devices.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
