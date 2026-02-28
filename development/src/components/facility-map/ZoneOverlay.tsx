'use client'

/**
 * ZoneOverlay — Renders labeled zone polygons on the facility map canvas.
 * Zones show as semi-transparent colored regions behind device markers.
 * In edit mode, zones can be clicked to select/delete.
 */

import { cn } from '@/lib/utils'
import type { FacilityMapZone } from '@/types/facility-map'

interface ZoneOverlayProps {
  zones: FacilityMapZone[]
  selectedZoneId?: string | null
  editMode?: boolean
  onSelectZone?: (zoneId: string | null) => void
}

export function ZoneOverlay({
  zones,
  selectedZoneId,
  editMode = false,
  onSelectZone,
}: ZoneOverlayProps) {
  if (zones.length === 0) return null

  return (
    <svg
      className="absolute inset-0 z-[5] h-full w-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {zones
        .sort((a, b) => a.z_order - b.z_order)
        .map((zone) => {
          const points = zone.points.map((p) => `${p.x},${p.y}`).join(' ')
          const isSelected = selectedZoneId === zone.id
          // Compute label position (centroid)
          const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length
          const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length

          return (
            <g key={zone.id}>
              <polygon
                points={points}
                fill={zone.color}
                fillOpacity={zone.opacity}
                stroke={isSelected ? '#fff' : zone.color}
                strokeWidth={isSelected ? 0.5 : 0.2}
                strokeOpacity={isSelected ? 1 : 0.7}
                className={cn(
                  editMode && 'pointer-events-auto cursor-pointer',
                  isSelected && 'animate-pulse'
                )}
                onClick={(e) => {
                  if (!editMode) return
                  e.stopPropagation()
                  onSelectZone?.(isSelected ? null : zone.id)
                }}
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="2.5"
                fontWeight="600"
                fill="#1f2937"
                fillOpacity="0.85"
                className="pointer-events-none select-none"
                style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 0.4 }}
              >
                {zone.name}
              </text>
            </g>
          )
        })}
    </svg>
  )
}
