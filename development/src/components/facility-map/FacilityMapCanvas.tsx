'use client'

/**
 * FacilityMapCanvas — Interactive canvas that renders a floor plan image
 * with device markers overlaid. Supports click-to-place, drag-to-reposition,
 * and real-time status display.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { DeviceMarker } from './DeviceMarker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MousePointer2,
  Plus,
  Trash2,
} from 'lucide-react'
import type {
  FacilityMap,
  DeviceMapPlacement,
  PlacementMode,
  PlacedDevice,
} from '@/types/facility-map'

interface FacilityMapCanvasProps {
  facilityMap: FacilityMap
  placements: DeviceMapPlacement[]
  availableDevices: PlacedDevice[]
  mode: PlacementMode
  selectedPlacementId: string | null
  deviceToPlace: string | null // device_id being placed
  onPlaceDevice: (deviceId: string, xPercent: number, yPercent: number) => void
  onMovePlacement: (placementId: string, xPercent: number, yPercent: number) => void
  onSelectPlacement: (placementId: string | null) => void
  onRemovePlacement: (placementId: string) => void
}

export function FacilityMapCanvas({
  facilityMap,
  placements,
  mode,
  selectedPlacementId,
  deviceToPlace,
  onPlaceDevice,
  onMovePlacement,
  onSelectPlacement,
  onRemovePlacement,
}: FacilityMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  // Reset when switching maps
  useEffect(() => {
    setImageLoaded(false)
  }, [facilityMap.id])

  // Click to place device — use the image container directly
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'place' || !deviceToPlace || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100

      if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
        onPlaceDevice(deviceToPlace, x, y)
      }
    },
    [mode, deviceToPlace, onPlaceDevice]
  )

  // Touch support for placing devices on mobile
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (mode !== 'place' || !deviceToPlace || !containerRef.current) return
      e.preventDefault()
      const touch = e.changedTouches[0]
      if (!touch) return

      const rect = containerRef.current.getBoundingClientRect()
      const x = ((touch.clientX - rect.left) / rect.width) * 100
      const y = ((touch.clientY - rect.top) / rect.height) * 100

      if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
        onPlaceDevice(deviceToPlace, x, y)
      }
    },
    [mode, deviceToPlace, onPlaceDevice]
  )

  return (
    <div className="relative flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          {mode === 'place' && deviceToPlace && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Tap on the map to place device
            </Badge>
          )}
          {mode === 'edit' && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <MousePointer2 className="h-3 w-3" />
              Drag devices to reposition
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedPlacementId && mode === 'edit' && (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onRemovePlacement(selectedPlacementId)}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Remove
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {placements.length} device{placements.length !== 1 ? 's' : ''} placed
          </span>
        </div>
      </div>

      {/* Canvas area */}
      <div
        className={cn(
          'relative overflow-auto bg-gray-100',
          mode === 'place' && deviceToPlace && 'cursor-crosshair'
        )}
        style={{ maxHeight: '500px', minHeight: '300px' }}
      >
        {!facilityMap.image_url ? (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-muted-foreground">No floor plan image uploaded</p>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="relative inline-block w-full"
            onClick={handleCanvasClick}
            onTouchEnd={handleTouchEnd}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={facilityMap.image_url}
              alt={facilityMap.name}
              className={cn(
                'w-full object-contain transition-opacity',
                imageLoaded ? 'opacity-100' : 'opacity-0'
              )}
              onLoad={() => setImageLoaded(true)}
              draggable={false}
            />

            {/* Device markers overlay */}
            {imageLoaded &&
              placements.map((p) => (
                <DeviceMarker
                  key={p.id}
                  placement={p}
                  mode={mode}
                  selected={p.id === selectedPlacementId}
                  onClick={() => onSelectPlacement(p.id === selectedPlacementId ? null : p.id)}
                  onDragEnd={(x, y) => onMovePlacement(p.id, x, y)}
                  containerRef={containerRef}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
