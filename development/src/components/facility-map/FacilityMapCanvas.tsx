'use client'

/**
 * FacilityMapCanvas — Interactive canvas that renders a floor plan image
 * with device markers overlaid. Supports click-to-place, drag-to-reposition,
 * and real-time status display.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { DeviceMarker } from './DeviceMarker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MousePointer2,
  Plus,
  Trash2,
  Download,
  Maximize2,
  Minimize2,
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
  deviceToPlace: string | null
  onPlaceDevice: (deviceId: string, xPercent: number, yPercent: number) => void
  onMovePlacement: (placementId: string, xPercent: number, yPercent: number) => void
  onSelectPlacement: (placementId: string | null) => void
  onRemovePlacement: (placementId: string) => void
  onDeviceNavigate?: (deviceId: string) => void
  telemetryMap?: Record<string, Record<string, unknown>>
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
  onDeviceNavigate,
  telemetryMap,
}: FacilityMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fullscreenRef = useRef<HTMLDivElement | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

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

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!fullscreenRef.current) return
    if (!document.fullscreenElement) {
      fullscreenRef.current.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Export map as PNG
  const exportMapAsPNG = useCallback(async () => {
    if (!facilityMap.image_url) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = facilityMap.image_url

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)

    const statusColors: Record<string, string> = {
      online: '#22c55e', offline: '#9ca3af', warning: '#f59e0b',
      error: '#ef4444', maintenance: '#3b82f6',
    }

    for (const p of placements) {
      const x = (p.x_percent / 100) * img.naturalWidth
      const y = (p.y_percent / 100) * img.naturalHeight
      const color = statusColors[p.device?.status || 'offline'] || '#9ca3af'
      ctx.beginPath()
      ctx.arc(x, y, 12, 0, Math.PI * 2)
      ctx.fillStyle = 'white'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, 9, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      const name = p.label || p.device?.name || ''
      if (name) {
        ctx.font = 'bold 14px sans-serif'
        ctx.fillStyle = '#1f2937'
        ctx.textAlign = 'center'
        ctx.fillText(name, x, y + 24)
      }
    }

    const link = document.createElement('a')
    link.download = `${facilityMap.name.replace(/[^a-z0-9]/gi, '_')}_map.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [facilityMap, placements])

  // Status summary
  const statusSummary = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of placements) {
      const s = p.device?.status || 'offline'
      counts[s] = (counts[s] || 0) + 1
    }
    return counts
  }, [placements])

  return (
    <div ref={fullscreenRef} className={cn('relative flex flex-col', isFullscreen && 'bg-background')}>
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
          {mode === 'view' && placements.length > 0 && (
            <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
              Click a device to view details
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
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
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={exportMapAsPNG}
            title="Export as PNG"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <span className="text-xs text-muted-foreground ml-1">
            {placements.length} device{placements.length !== 1 ? 's' : ''} placed
          </span>
        </div>
      </div>

      {/* Status summary bar */}
      {placements.length > 0 && (
        <div className="flex items-center gap-4 border-b bg-muted/10 px-3 py-1.5">
          {Object.entries(statusSummary).map(([status, count]) => (
            <div key={status} className="flex items-center gap-1.5 text-xs">
              <span className={cn(
                'h-2 w-2 rounded-full',
                status === 'online' && 'bg-green-500',
                status === 'offline' && 'bg-gray-400',
                status === 'warning' && 'bg-amber-500',
                status === 'error' && 'bg-red-500',
                status === 'maintenance' && 'bg-blue-500',
              )} />
              <span className="text-muted-foreground capitalize">{count} {status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Canvas area */}
      <div
        className={cn(
          'relative overflow-auto bg-gray-100',
          mode === 'place' && deviceToPlace && 'cursor-crosshair'
        )}
        style={{ maxHeight: isFullscreen ? 'calc(100vh - 80px)' : '500px', minHeight: '300px' }}
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
                  onNavigate={onDeviceNavigate}
                  onDragEnd={(x, y) => onMovePlacement(p.id, x, y)}
                  containerRef={containerRef}
                  telemetry={telemetryMap?.[p.device_id]}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
