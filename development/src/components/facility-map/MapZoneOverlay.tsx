'use client'

/**
 * MapZoneOverlay — Renders SVG polygon zones on the facility map canvas.
 * Zones are semi-transparent overlays with labels, used to define named
 * areas like "Server Room", "Cold Storage", etc.
 *
 * In edit mode, supports:
 *  - Click to start drawing a new zone (polygon points)
 *  - Double-click to finish the polygon
 *  - Click existing zone to select it for editing/deletion
 */

import { useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { MapZone } from '@/types/facility-map'

interface MapZoneOverlayProps {
  zones: MapZone[]
  /** Canvas width in px (rendered image content area) */
  width: number
  /** Canvas height in px (rendered image content area) */
  height: number
  /** Whether zones can be drawn/edited */
  editMode?: boolean
  /** Currently selected zone id */
  selectedZoneId?: string | null
  onSelectZone?: (zoneId: string | null) => void
  /** Called when user finishes drawing a new zone polygon */
  onCreateZone?: (points: { x: number; y: number }[]) => void
  /** Whether zone drawing is active (user clicked "Draw Zone") */
  drawing?: boolean
}

export function MapZoneOverlay({
  zones,
  width,
  height,
  editMode = false,
  selectedZoneId,
  onSelectZone,
  onCreateZone,
  drawing = false,
}: MapZoneOverlayProps) {
  // Points being drawn (percentage coords)
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([])
  // Mouse position for the "live" edge from last point to cursor
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!drawing || !onCreateZone) return
      e.stopPropagation()
      const rect = e.currentTarget.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      setDrawingPoints((prev) => [...prev, { x, y }])
    },
    [drawing, onCreateZone]
  )

  const handleSvgDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing || drawingPoints.length < 3 || !onCreateZone) return
      e.stopPropagation()
      e.preventDefault()
      onCreateZone(drawingPoints)
      setDrawingPoints([])
      setCursorPos(null)
    },
    [drawing, drawingPoints, onCreateZone]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!drawing || drawingPoints.length === 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      setCursorPos({ x, y })
    },
    [drawing, drawingPoints]
  )

  // Convert percentage points to SVG polygon points string
  const toSvgPoints = useCallback(
    (points: { x: number; y: number }[]) =>
      points.map((p) => `${(p.x / 100) * width},${(p.y / 100) * height}`).join(' '),
    [width, height]
  )

  // Compute label position (centroid of polygon)
  const centroid = useCallback((points: { x: number; y: number }[]) => {
    if (points.length === 0) return { x: 0, y: 0 }
    const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length
    const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length
    return { x: (cx / 100) * width, y: (cy / 100) * height }
  }, [width, height])

  // Sort zones by z_order
  const sortedZones = useMemo(
    () => [...zones].sort((a, b) => a.z_order - b.z_order),
    [zones]
  )

  if (zones.length === 0 && !drawing) return null

  return (
    <svg
      className={cn(
        'absolute inset-0 z-[5] pointer-events-none',
        (drawing || editMode) && 'pointer-events-auto',
        drawing && 'cursor-crosshair'
      )}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onClick={handleSvgClick}
      onDoubleClick={handleSvgDoubleClick}
      onMouseMove={handleMouseMove}
    >
      {/* Existing zones */}
      {sortedZones.map((zone) => {
        const isSelected = zone.id === selectedZoneId
        const center = centroid(zone.points)
        // Compute bounding box width for label truncation
        const xs = zone.points.map((p) => (p.x / 100) * width)
        const zonePixelWidth = xs.length > 0 ? Math.max(...xs) - Math.min(...xs) : 100

        return (
          <g key={zone.id}>
            <polygon
              points={toSvgPoints(zone.points)}
              fill={zone.color}
              fillOpacity={0.15}
              stroke={zone.color}
              strokeWidth={isSelected ? 2.5 : 1.5}
              strokeDasharray={isSelected ? 'none' : '4 2'}
              className={cn(
                'transition-all',
                editMode && 'pointer-events-auto cursor-pointer hover:fill-opacity-25'
              )}
              onClick={(e) => {
                if (!editMode) return
                e.stopPropagation()
                onSelectZone?.(isSelected ? null : zone.id)
              }}
            />
            {/* Zone label at centroid */}
            <text
              x={center.x}
              y={center.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="pointer-events-none select-none"
              fill={zone.color}
              fontSize={Math.max(10, Math.min(14, zonePixelWidth / zone.name.length * 1.2))}
              fontWeight="600"
              opacity={0.8}
            >
              {zone.name.length > zonePixelWidth / 7
                ? zone.name.slice(0, Math.floor(zonePixelWidth / 7)) + '…'
                : zone.name}
            </text>
          </g>
        )
      })}

      {/* Drawing in progress */}
      {drawing && drawingPoints.length > 0 && (
        <g>
          {/* Filled preview polygon */}
          {drawingPoints.length >= 3 && (
            <polygon
              points={toSvgPoints(drawingPoints)}
              fill="#3B82F6"
              fillOpacity={0.1}
              stroke="#3B82F6"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
          )}
          {/* Lines between placed points */}
          {drawingPoints.map((p, i) => {
            if (i === 0) return null
            const prev = drawingPoints[i - 1]!
            return (
              <line
                key={i}
                x1={(prev.x / 100) * width}
                y1={(prev.y / 100) * height}
                x2={(p.x / 100) * width}
                y2={(p.y / 100) * height}
                stroke="#3B82F6"
                strokeWidth={2}
              />
            )
          })}
          {/* Live edge from last point to cursor */}
          {cursorPos && drawingPoints.length > 0 && (
            <line
              x1={(drawingPoints[drawingPoints.length - 1]!.x / 100) * width}
              y1={(drawingPoints[drawingPoints.length - 1]!.y / 100) * height}
              x2={(cursorPos.x / 100) * width}
              y2={(cursorPos.y / 100) * height}
              stroke="#3B82F6"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              opacity={0.6}
            />
          )}
          {/* Point indicators */}
          {drawingPoints.map((p, i) => (
            <circle
              key={i}
              cx={(p.x / 100) * width}
              cy={(p.y / 100) * height}
              r={4}
              fill="white"
              stroke="#3B82F6"
              strokeWidth={2}
            />
          ))}
        </g>
      )}
    </svg>
  )
}
