'use client'

/**
 * DevicePalette — Side panel listing all devices in the org.
 * Devices already placed on the current map are shown with a badge.
 * Un-placed devices can be clicked to enter "place" mode.
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
} from 'lucide-react'
import type { PlacedDevice, DeviceMapPlacement } from '@/types/facility-map'

const STATUS_DOT: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  maintenance: 'bg-blue-500',
}

const STATUS_BLINK: Record<string, string> = {
  online: 'animate-pulse bg-green-500',
  offline: 'animate-[pulse_3s_ease-in-out_infinite] bg-red-500',
  warning: 'animate-pulse bg-amber-500',
  error: 'animate-pulse bg-red-500',
  maintenance: 'bg-blue-500',
}

/** Sort priority: online first, then warning/error/maintenance, offline last */
const STATUS_SORT_ORDER: Record<string, number> = {
  online: 0,
  warning: 1,
  error: 2,
  maintenance: 3,
  offline: 4,
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
    return devices.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.device_type.toLowerCase().includes(q)
    )
  }, [devices, search])

  const unplaced = filtered
    .filter((d) => !placedDeviceIds.has(d.id))
    .sort((a, b) => (STATUS_SORT_ORDER[a.status] ?? 9) - (STATUS_SORT_ORDER[b.status] ?? 9))
  const placed = filtered
    .filter((d) => placedDeviceIds.has(d.id))
    .sort((a, b) => (STATUS_SORT_ORDER[a.status] ?? 9) - (STATUS_SORT_ORDER[b.status] ?? 9))

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
                          'flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors',
                          'hover:bg-accent',
                          deviceToPlace === device.id && 'bg-primary/10 ring-1 ring-primary'
                        )}
                        onClick={() =>
                          onSelectToPlace(deviceToPlace === device.id ? null : device.id)
                        }
                      >
                        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STATUS_BLINK[device.status] || STATUS_DOT[device.status])} />
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
                          className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-accent"
                        >
                          <span
                            className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STATUS_BLINK[device.status] || STATUS_DOT[device.status])}
                          />
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
