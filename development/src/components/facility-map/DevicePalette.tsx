'use client'

/**
 * DevicePalette — Side panel listing all devices in the org.
 * Devices already placed on the current map are shown with a badge.
 * Un-placed devices can be clicked or dragged to the map to place them.
 * Sorted: online first, then offline, then others.
 */

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  Smartphone,
  Search,
  MapPin,
  Plus,
  Wifi,
  WifiOff,
  AlertTriangle,
  Wrench,
  X,
  GripVertical,
} from 'lucide-react'
import type { PlacedDevice, DeviceMapPlacement } from '@/types/facility-map'

const STATUS_ORDER: Record<string, number> = {
  online: 0,
  warning: 1,
  error: 2,
  maintenance: 3,
  offline: 4,
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'online':
      return <Wifi className="h-3.5 w-3.5 text-green-500 shrink-0" />
    case 'offline':
      return <WifiOff className="h-3.5 w-3.5 text-red-500 shrink-0" />
    case 'warning':
    case 'error':
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
    case 'maintenance':
      return <Wrench className="h-3.5 w-3.5 text-blue-500 shrink-0" />
    default:
      return <WifiOff className="h-3.5 w-3.5 text-red-500 shrink-0" />
  }
}

interface DevicePaletteProps {
  devices: PlacedDevice[]
  placements: DeviceMapPlacement[]
  deviceToPlace: string | null
  onSelectToPlace: (deviceId: string | null) => void
  onRemovePlacement: (placementId: string) => void
  loading?: boolean
}

export function DevicePalette({
  devices,
  placements,
  deviceToPlace,
  onSelectToPlace,
  onRemovePlacement,
  loading = false,
}: DevicePaletteProps) {
  const [search, setSearch] = useState('')

  const placedDeviceIds = useMemo(
    () => new Set(placements.map((p) => p.device_id)),
    [placements]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const list = devices.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.device_type.toLowerCase().includes(q)
    )
    // Sort: online first, then warning/error, then maintenance, then offline
    return list.sort((a, b) => (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4))
  }, [devices, search])

  const unplaced = filtered.filter((d) => !placedDeviceIds.has(d.id))
  const placed = filtered.filter((d) => placedDeviceIds.has(d.id))

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Smartphone className="h-4 w-4" />
          Devices
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {placements.length} / {devices.length} placed
          </Badge>
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {loading ? (
            <div className="space-y-2 py-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Unplaced devices */}
              {unplaced.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                    Available ({unplaced.length})
                  </p>
                  <div className="space-y-1">
                    {unplaced.map((device) => (
                      <button
                        key={device.id}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg p-2.5 text-left transition-colors',
                          'hover:bg-accent',
                          deviceToPlace === device.id && 'bg-primary/10 ring-1 ring-primary'
                        )}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/x-device-id', device.id)
                          e.dataTransfer.effectAllowed = 'copy'
                        }}
                        onClick={() =>
                          onSelectToPlace(deviceToPlace === device.id ? null : device.id)
                        }
                      >
                        <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/50" />
                        <StatusIcon status={device.status} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{device.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{device.device_type}</p>
                        </div>
                        {deviceToPlace === device.id ? (
                          <X className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Placed devices */}
              {placed.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                    On Map ({placed.length})
                  </p>
                  <div className="space-y-1">
                    {placed.map((device) => {
                      const placement = placements.find((p) => p.device_id === device.id)
                      return (
                        <div
                          key={device.id}
                          className="flex items-center gap-2 rounded-lg p-2.5 hover:bg-accent"
                        >
                          <StatusIcon status={device.status} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{device.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{device.device_type}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-green-600" />
                            {placement && (
                              <button
                                className="rounded p-1 hover:bg-destructive/10"
                                title="Remove from map"
                                onClick={() => onRemovePlacement(placement.id)}
                              >
                                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {filtered.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {search ? 'No devices match your search' : 'No devices in this organization'}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
