'use client'

/**
 * DeviceMarker — Renders a single device dot on the facility map canvas.
 * Shows status colour, tooltip on hover, and handles drag-and-drop repositioning.
 */

import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { DeviceMapPlacement, PlacedDevice, PlacementMode } from '@/types/facility-map'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Wifi, WifiOff, AlertTriangle, Battery, Wrench } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-green-500 shadow-green-500/50',
  offline: 'bg-gray-400 shadow-gray-400/50',
  warning: 'bg-amber-500 shadow-amber-500/50',
  error: 'bg-red-500 shadow-red-500/50',
  maintenance: 'bg-blue-500 shadow-blue-500/50',
}

const STATUS_RING: Record<string, string> = {
  online: 'ring-green-400',
  offline: 'ring-gray-300',
  warning: 'ring-amber-400',
  error: 'ring-red-400',
  maintenance: 'ring-blue-400',
}

const SIZE_MAP = {
  small: { dot: 'h-3 w-3', pulse: 'h-5 w-5' },
  medium: { dot: 'h-4 w-4', pulse: 'h-6 w-6' },
  large: { dot: 'h-5 w-5', pulse: 'h-7 w-7' },
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'online':
      return <Wifi className="h-3 w-3" />
    case 'offline':
      return <WifiOff className="h-3 w-3" />
    case 'warning':
    case 'error':
      return <AlertTriangle className="h-3 w-3" />
    case 'maintenance':
      return <Wrench className="h-3 w-3" />
    default:
      return <Wifi className="h-3 w-3" />
  }
}

interface DeviceMarkerProps {
  placement: DeviceMapPlacement
  mode: PlacementMode
  selected?: boolean
  onClick?: () => void
  onDragEnd?: (xPercent: number, yPercent: number) => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function DeviceMarker({
  placement,
  mode,
  selected = false,
  onClick,
  onDragEnd,
  containerRef,
}: DeviceMarkerProps) {
  const device = placement.device
  const status = device?.status || 'offline'
  const size = SIZE_MAP[placement.icon_size] || SIZE_MAP.medium
  const [dragging, setDragging] = useState(false)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  const displayName = placement.label || device?.name || 'Unknown Device'

  // Drag handling for edit mode
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'edit' || !containerRef.current) return
      e.preventDefault()
      e.stopPropagation()
      const rect = containerRef.current.getBoundingClientRect()
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: placement.x_percent,
        origY: placement.y_percent,
      }
      setDragging(true)

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragStartRef.current || !containerRef.current) return
        const r = containerRef.current.getBoundingClientRect()
        const dx = ((ev.clientX - dragStartRef.current.startX) / r.width) * 100
        const dy = ((ev.clientY - dragStartRef.current.startY) / r.height) * 100
        const nx = Math.max(0, Math.min(100, dragStartRef.current.origX + dx))
        const ny = Math.max(0, Math.min(100, dragStartRef.current.origY + dy))
        setDragPos({ x: nx, y: ny })
      }

      const handleMouseUp = (ev: MouseEvent) => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        setDragging(false)
        if (dragStartRef.current && containerRef.current) {
          const r = containerRef.current.getBoundingClientRect()
          const dx = ((ev.clientX - dragStartRef.current.startX) / r.width) * 100
          const dy = ((ev.clientY - dragStartRef.current.startY) / r.height) * 100
          const nx = Math.max(0, Math.min(100, dragStartRef.current.origX + dx))
          const ny = Math.max(0, Math.min(100, dragStartRef.current.origY + dy))
          setDragPos(null)
          onDragEnd?.(nx, ny)
        }
        dragStartRef.current = null
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [mode, containerRef, placement.x_percent, placement.y_percent, onDragEnd]
  )

  const posX = dragPos ? dragPos.x : placement.x_percent
  const posY = dragPos ? dragPos.y : placement.y_percent

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-shadow',
              mode === 'edit' && 'cursor-grab',
              dragging && 'cursor-grabbing z-50',
              selected && 'z-40'
            )}
            style={{
              left: `${posX}%`,
              top: `${posY}%`,
            }}
            onClick={(e) => {
              e.stopPropagation()
              onClick?.()
            }}
            onMouseDown={handleMouseDown}
          >
            {/* Pulse ring for online devices */}
            {status === 'online' && !dragging && (
              <span
                className={cn(
                  'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 animate-ping',
                  STATUS_COLORS[status],
                  size.pulse
                )}
              />
            )}
            {/* Main dot */}
            <span
              className={cn(
                'relative block rounded-full shadow-lg ring-2 ring-white',
                STATUS_COLORS[status],
                size.dot,
                selected && `ring-4 ${STATUS_RING[status]}`
              )}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          <div className="space-y-1">
            <p className="font-medium text-sm">{displayName}</p>
            <div className="flex items-center gap-1.5 text-xs">
              <StatusIcon status={status} />
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] px-1.5 py-0',
                  status === 'online' && 'border-green-400 text-green-700',
                  status === 'offline' && 'border-gray-300 text-gray-500',
                  status === 'warning' && 'border-amber-400 text-amber-700',
                  status === 'error' && 'border-red-400 text-red-700',
                  status === 'maintenance' && 'border-blue-400 text-blue-700'
                )}
              >
                {status}
              </Badge>
            </div>
            {device?.device_type && (
              <p className="text-xs text-muted-foreground">{device.device_type}</p>
            )}
            {device?.battery_level != null && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Battery className="h-3 w-3" />
                {device.battery_level}%
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
