'use client'

/**
 * FacilityMapCanvas — Interactive canvas that renders a floor plan image
 * with device markers overlaid. Supports click-to-place, drag-to-reposition,
 * and real-time status display.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { DeviceMarker } from './DeviceMarker'
import { ZoneOverlay } from './ZoneOverlay'
import { HeatmapOverlay, HeatmapLegend, formatMetricLabel } from './HeatmapOverlay'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MousePointer2,
  Plus,
  Trash2,
  Download,
  Maximize2,
  Minimize2,
  Filter,
  Hexagon,
} from 'lucide-react'
import type {
  FacilityMap,
  DeviceMapPlacement,
  PlacementMode,
  PlacedDevice,
  FacilityMapZone,
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
  /** Zone annotations to overlay on the map */
  zones?: FacilityMapZone[]
  selectedZoneId?: string | null
  onSelectZone?: (zoneId: string | null) => void
  /** Callback when canvas is clicked in zone-drawing mode */
  onZonePointAdd?: (xPercent: number, yPercent: number) => void
  /** Whether zone drawing mode is active */
  zoneDrawing?: boolean
  /** Show device name labels next to sensor pins */
  showLabels?: boolean
  /** Callback when show labels toggle changes */
  onShowLabelsChange?: (show: boolean) => void
  /** Show device type labels next to sensor pins */
  showDeviceTypes?: boolean
  /** Callback when show device types toggle changes */
  onShowDeviceTypesChange?: (show: boolean) => void
  /** Currently selected heatmap metric (empty string = off) */
  heatmapMetric?: string
  /** Callback when heatmap metric changes */
  onHeatmapMetricChange?: (metric: string) => void
  /** Available heatmap metric keys */
  availableHeatmapMetrics?: string[]
  /** Hidden device types set */
  hiddenDeviceTypes?: Set<string>
  /** Callback to toggle a device type */
  onToggleDeviceType?: (type: string) => void
  /** Callback to show all device types */
  onShowAllTypes?: () => void
  /** Callback to toggle zone drawing mode */
  onToggleZoneDrawing?: () => void
  /** Callback to delete the selected zone */
  onDeleteZone?: (zoneId: string) => void
  /** Number of zone points placed so far (for step instructions) */
  zonePointCount?: number
  /** Compact mode for collage grid — hides toolbar, shrinks canvas */
  compact?: boolean
  /** Hide fullscreen button (parent handles it) */
  hideFullscreen?: boolean
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
  zones = [],
  selectedZoneId,
  onSelectZone,
  onZonePointAdd,
  zoneDrawing = false,
  showLabels = false,
  onShowLabelsChange,
  showDeviceTypes = false,
  onShowDeviceTypesChange,
  heatmapMetric = '',
  onHeatmapMetricChange,
  availableHeatmapMetrics = [],
  hiddenDeviceTypes,
  onToggleDeviceType,
  onShowAllTypes,
  onToggleZoneDrawing,
  onDeleteZone,
  zonePointCount = 0,
  compact = false,
  hideFullscreen = false,
}: FacilityMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fullscreenRef = useRef<HTMLDivElement | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Reset when switching maps
  useEffect(() => {
    setImageLoaded(false)
  }, [facilityMap.id])

  // Click to place device or add zone point
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100

      if (x < 0 || x > 100 || y < 0 || y > 100) return

      // Zone drawing takes priority
      if (zoneDrawing && onZonePointAdd) {
        onZonePointAdd(x, y)
        return
      }

      if (mode !== 'place' || !deviceToPlace) return

      if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
        onPlaceDevice(deviceToPlace, x, y)
      }
    },
    [mode, deviceToPlace, onPlaceDevice, zoneDrawing, onZonePointAdd]
  )

  // Drop handler for drag-and-drop from DevicePalette
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const deviceId = e.dataTransfer.getData('application/x-device-id')
      if (!deviceId || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100

      if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
        onPlaceDevice(deviceId, x, y)
      }
    },
    [onPlaceDevice]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-device-id')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  // Touch support for placing devices on mobile
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!containerRef.current) return
      e.preventDefault()
      const touch = e.changedTouches[0]
      if (!touch) return

      const rect = containerRef.current.getBoundingClientRect()
      const x = ((touch.clientX - rect.left) / rect.width) * 100
      const y = ((touch.clientY - rect.top) / rect.height) * 100

      if (x < 0 || x > 100 || y < 0 || y > 100) return

      // Zone drawing takes priority
      if (zoneDrawing && onZonePointAdd) {
        onZonePointAdd(x, y)
        return
      }

      if (mode !== 'place' || !deviceToPlace) return

      onPlaceDevice(deviceToPlace, x, y)
    },
    [mode, deviceToPlace, onPlaceDevice, zoneDrawing, onZonePointAdd]
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

  // Device type counts
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of placements) {
      const dt = p.device?.device_type || 'unknown'
      counts[dt] = (counts[dt] || 0) + 1
    }
    return counts
  }, [placements])
  const deviceTypes = useMemo(() => Object.keys(typeCounts).sort(), [typeCounts])

  return (
    <div ref={fullscreenRef} className={cn('relative flex flex-col', isFullscreen && 'bg-background')}>
      {/* Toolbar — hidden in compact mode */}
      {!compact && (
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
              Click icon to see full device details
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {placements.length} device{placements.length !== 1 ? 's' : ''} placed
          </span>
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
          {!hideFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          )}
        </div>
      </div>
      )}

      {/* Status + type + heatmap + zone bar — hidden in compact mode */}
      {!compact && (placements.length > 0 || onToggleZoneDrawing) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/10 px-3 py-1.5">
          {/* Status counts */}
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

          {/* Separator */}
          {deviceTypes.length > 1 && (
            <span className="text-muted-foreground/40">|</span>
          )}

          {/* Device type filter chips */}
          {deviceTypes.length > 1 && (
            <>
              <Filter className="h-3 w-3 text-muted-foreground" />
              {deviceTypes.map((dt) => {
                const isHidden = hiddenDeviceTypes?.has(dt)
                return (
                  <button
                    key={dt}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      isHidden
                        ? 'border-muted bg-muted/50 text-muted-foreground line-through opacity-60'
                        : 'border-primary/30 bg-primary/5 text-foreground'
                    }`}
                    onClick={() => onToggleDeviceType?.(dt)}
                  >
                    {dt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    <span className="text-muted-foreground">({typeCounts[dt]})</span>
                  </button>
                )
              })}
              {hiddenDeviceTypes && hiddenDeviceTypes.size > 0 && (
                <button
                  className="text-[11px] text-primary hover:underline"
                  onClick={onShowAllTypes}
                >
                  Show All
                </button>
              )}
            </>
          )}

          {/* Separator before heatmap */}
          {availableHeatmapMetrics.length > 0 && (
            <span className="text-muted-foreground/40">|</span>
          )}

          {/* Show device names checkbox */}
          {onShowLabelsChange && (
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => onShowLabelsChange(e.target.checked)}
                className="h-3 w-3 rounded accent-primary cursor-pointer"
              />
              Show Device Names
            </label>
          )}

          {/* Show device type checkbox */}
          {onShowDeviceTypesChange && (
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showDeviceTypes}
                onChange={(e) => onShowDeviceTypesChange(e.target.checked)}
                className="h-3 w-3 rounded accent-primary cursor-pointer"
              />
              Show Device Type
            </label>
          )}

          {/* Heatmap selector */}
          {availableHeatmapMetrics.length > 0 && (
            <label className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              Heatmap
              <select
                value={heatmapMetric}
                onChange={(e) => onHeatmapMetricChange?.(e.target.value)}
                className="rounded border bg-background px-1.5 py-0.5 text-[11px]"
              >
                <option value="">Off</option>
                {availableHeatmapMetrics.map((m) => (
                  <option key={m} value={m}>{formatMetricLabel(m)}</option>
                ))}
              </select>
            </label>
          )}

          {/* Separator before zone tools */}
          {onToggleZoneDrawing && (
            <span className="text-muted-foreground/40">|</span>
          )}

          {/* Zone draw / delete */}
          {onToggleZoneDrawing && (
            <>
              <button
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  zoneDrawing
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-primary/30 bg-primary/5 text-foreground hover:bg-primary/10'
                }`}
                onClick={onToggleZoneDrawing}
              >
                <Hexagon className="h-3 w-3" />
                {zoneDrawing ? 'Cancel Zone' : 'Draw Zone'}
              </button>
              {zoneDrawing && (
                <span className="text-[11px] text-muted-foreground italic">
                  {zonePointCount === 0
                    ? 'Click on map to place 1st point'
                    : zonePointCount === 1
                    ? 'Click to place 2nd point'
                    : zonePointCount === 2
                    ? 'Click to place 3rd point (minimum)'
                    : `${zonePointCount} points — click to add more or save`}
                </span>
              )}
              {selectedZoneId && mode === 'edit' && onDeleteZone && (
                <button
                  className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => onDeleteZone(selectedZoneId)}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete Zone
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Canvas area */}
      <div
        className={cn(
          'relative bg-gray-100 overflow-hidden',
          mode === 'place' && deviceToPlace && 'cursor-crosshair'
        )}
        style={compact
          ? undefined
          : { maxHeight: isFullscreen ? 'calc(100vh - 80px)' : '520px', overflow: 'hidden' }
        }
      >
        {!facilityMap.image_url ? (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-muted-foreground">No floor plan image uploaded</p>
          </div>
        ) : (
          <div
            ref={containerRef}
            className={cn('relative inline-block', !compact && 'w-full')}
            onClick={handleCanvasClick}
            onTouchEnd={handleTouchEnd}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={facilityMap.image_url}
              alt={facilityMap.name}
              className={cn(
                'block transition-opacity',
                compact ? 'max-w-full max-h-[280px]' : 'w-full',
                imageLoaded ? 'opacity-100' : 'opacity-0'
              )}
              onLoad={() => setImageLoaded(true)}
              draggable={false}
            />

            {/* Heatmap overlay (behind zones and markers) */}
            {imageLoaded && heatmapMetric && telemetryMap && (
              <HeatmapOverlay
                placements={placements}
                telemetryMap={telemetryMap}
                metric={heatmapMetric}
              />
            )}

            {/* Zone overlays (behind device markers) */}
            {imageLoaded && zones.length > 0 && (
              <ZoneOverlay
                zones={zones}
                selectedZoneId={selectedZoneId}
                editMode={mode === 'edit'}
                onSelectZone={onSelectZone}
              />
            )}

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
                  showLabel={showLabels}
                  showDeviceType={showDeviceTypes}
                  heatmapMetric={heatmapMetric}
                />
              ))}

            {/* Heatmap legend */}
            {imageLoaded && heatmapMetric && telemetryMap && !compact && (() => {
              const pts = placements.filter((p) => {
                const raw = telemetryMap[p.device_id]?.[heatmapMetric]
                const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
                return !isNaN(n)
              }).map((p) => {
                const raw = telemetryMap[p.device_id]![heatmapMetric]
                return typeof raw === 'number' ? raw : parseFloat(String(raw))
              })
              if (pts.length < 2) return null
              const min = Math.min(...pts)
              const max = Math.max(...pts)
              return (
                <div className="absolute bottom-2 left-2 rounded-lg bg-black/70 px-3 py-1.5 backdrop-blur-sm" style={{ zIndex: 20 }}>
                  <HeatmapLegend min={min} max={max} metric={heatmapMetric} />
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
