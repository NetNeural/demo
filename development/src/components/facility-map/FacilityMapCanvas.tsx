'use client'

/**
 * FacilityMapCanvas — Interactive canvas that renders a floor plan image
 * with device markers overlaid. Supports zoom, pan, click-to-place,
 * drag-to-reposition, and real-time status display.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { DeviceMarker } from './DeviceMarker'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  MousePointer2,
  Plus,
  Trash2,
} from 'lucide-react'
import type {
  FacilityMap,
  DeviceMapPlacement,
  MapViewport,
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

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

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
  const [viewport, setViewport] = useState<MapViewport>({ scale: 1, offsetX: 0, offsetY: 0 })
  const [imageLoaded, setImageLoaded] = useState(false)
  const isPanning = useRef(false)
  const lastPan = useRef({ x: 0, y: 0 })

  // Reset viewport when switching maps
  useEffect(() => {
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 })
    setImageLoaded(false)
  }, [facilityMap.id])

  const zoomIn = () =>
    setViewport((v) => ({ ...v, scale: Math.min(MAX_ZOOM, v.scale + ZOOM_STEP) }))
  const zoomOut = () =>
    setViewport((v) => ({ ...v, scale: Math.max(MIN_ZOOM, v.scale - ZOOM_STEP) }))
  const resetView = () =>
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 })

  // Scroll wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
    setViewport((v) => ({
      ...v,
      scale: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.scale + delta)),
    }))
  }, [])

  // Pan via middle mouse or when in view mode
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle mouse button or right-click for panning
      if (e.button === 1 || (e.button === 0 && mode === 'view' && !deviceToPlace)) {
        isPanning.current = true
        lastPan.current = { x: e.clientX, y: e.clientY }
        e.preventDefault()
      }
    },
    [mode, deviceToPlace]
  )

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    const dx = e.clientX - lastPan.current.x
    const dy = e.clientY - lastPan.current.y
    lastPan.current = { x: e.clientX, y: e.clientY }
    setViewport((v) => ({ ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy }))
  }, [])

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
  }, [])

  // Click to place device
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'place' || !deviceToPlace || !containerRef.current) return

      // Get click position relative to the image container
      const imageEl = containerRef.current.querySelector('[data-map-image]') as HTMLElement
      if (!imageEl) return

      const rect = imageEl.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100

      if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
        onPlaceDevice(deviceToPlace, x, y)
      }
    },
    [mode, deviceToPlace, onPlaceDevice]
  )

  const zoomPercent = Math.round(viewport.scale * 100)

  return (
    <div className="relative flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[48px] text-center text-xs font-medium text-muted-foreground">
            {zoomPercent}%
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetView} title="Reset view">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'place' && deviceToPlace && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Click on the map to place device
            </Badge>
          )}
          {mode === 'edit' && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <MousePointer2 className="h-3 w-3" />
              Drag devices to reposition
            </Badge>
          )}
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
          'relative overflow-hidden bg-gray-100',
          mode === 'place' && deviceToPlace && 'cursor-crosshair',
          mode === 'view' && 'cursor-grab'
        )}
        style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
      >
        {!facilityMap.image_url ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">No floor plan image uploaded</p>
          </div>
        ) : (
          <div
            className="relative mx-auto h-full"
            style={{
              transform: `scale(${viewport.scale}) translate(${viewport.offsetX / viewport.scale}px, ${viewport.offsetY / viewport.scale}px)`,
              transformOrigin: 'center center',
              transition: isPanning.current ? 'none' : 'transform 0.15s ease-out',
            }}
          >
            {/* Map image */}
            <div
              ref={containerRef}
              data-map-image
              className="relative mx-auto h-full"
              style={{ maxWidth: '100%' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={facilityMap.image_url}
                alt={facilityMap.name}
                className={cn(
                  'h-full w-full object-contain transition-opacity',
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
          </div>
        )}
      </div>
    </div>
  )
}
