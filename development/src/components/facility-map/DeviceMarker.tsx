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
import { Wifi, WifiOff, AlertTriangle, Battery, Wrench, ExternalLink, Clock } from 'lucide-react'

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

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatTelemetryKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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
  onNavigate?: (deviceId: string) => void
  onDragEnd?: (xPercent: number, yPercent: number) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  telemetry?: Record<string, unknown> | null
  /** Show device name label below the marker dot */
  showLabel?: boolean
  /** Show device type below the name label */
  showDeviceType?: boolean
  /** Show telemetry readings below the marker */
  showReadings?: boolean
  /** Scale factor for the marker (1 = full, <1 for compact views) */
  scale?: number
}

export function DeviceMarker({
  placement,
  mode,
  selected = false,
  onClick,
  onNavigate,
  onDragEnd,
  containerRef,
  telemetry,
  showLabel = false,
  showDeviceType = false,
  showReadings = false,
  scale = 1,
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
              'absolute z-10 transition-shadow',
              mode === 'view' && onNavigate && 'cursor-pointer',
              mode === 'edit' && 'cursor-grab',
              dragging && 'cursor-grabbing z-50',
              selected && 'z-40'
            )}
            style={{
              left: `${posX}%`,
              top: `${posY}%`,
              transform: `translate(-50%, -50%) scale(${scale})`,
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (mode === 'view' && onNavigate && placement.device_id) {
                onNavigate(placement.device_id)
              } else {
                onClick?.()
              }
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
            {/* Alert blink for warning/error */}
            {(status === 'warning' || status === 'error') && !dragging && (
              <span
                className={cn(
                  'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 animate-pulse',
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
            {/* Device name / type pill labels — stacked */}
            {(showLabel || showDeviceType) && (
              <div className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 flex flex-col items-center gap-px pointer-events-none">
                {showLabel && (
                  <span className="whitespace-nowrap rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium leading-tight text-white">
                    {displayName}
                  </span>
                )}
                {showDeviceType && device?.device_type && (
                  <span className="whitespace-nowrap rounded bg-black/50 px-1 py-0.5 text-[9px] font-normal leading-tight text-gray-200">
                    {device.device_type}
                  </span>
                )}
                {showReadings && telemetry && Object.keys(telemetry).length > 0 && (
                  <span className="whitespace-nowrap rounded bg-black/60 px-1 py-0.5 text-[8px] font-mono leading-tight text-green-300">
                    {Object.entries(telemetry).slice(0, 3).map(([k, v]) =>
                      `${formatTelemetryKey(k)}: ${typeof v === 'number' ? v.toFixed(1) : String(v ?? '')}`
                    ).join(' | ')}
                  </span>
                )}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] bg-gray-900 text-gray-100 border-gray-700 shadow-xl">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm text-white">{displayName}</p>
              {mode === 'view' && onNavigate && (
                <ExternalLink className="h-3 w-3 text-gray-400 shrink-0" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <StatusIcon status={status} />
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] px-1.5 py-0',
                  status === 'online' && 'border-green-400 text-green-400',
                  status === 'offline' && 'border-gray-400 text-gray-300',
                  status === 'warning' && 'border-amber-400 text-amber-400',
                  status === 'error' && 'border-red-400 text-red-400',
                  status === 'maintenance' && 'border-blue-400 text-blue-400'
                )}
              >
                {status}
              </Badge>
              {device?.last_seen && (
                <span className="flex items-center gap-1 text-gray-400">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(device.last_seen)}
                </span>
              )}
            </div>
            {device?.device_type && (
              <p className="text-xs text-gray-400">{device.device_type}</p>
            )}
            {device?.battery_level != null && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Battery className="h-3 w-3" />
                {device.battery_level}%
              </div>
            )}
            {/* Telemetry readings */}
            {telemetry && Object.keys(telemetry).length > 0 && (
              <div className="border-t border-gray-700 pt-1.5 mt-0.5">
                <p className="text-[10px] font-medium uppercase text-gray-500 mb-1">Latest Readings</p>
                <div className="space-y-0.5">
                  {Object.entries(telemetry).slice(0, 6).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-xs gap-3">
                      <span className="text-gray-400 truncate">{formatTelemetryKey(key)}</span>
                      <span className="font-mono text-gray-100 shrink-0">
                        {typeof value === 'number' ? value.toFixed(1) : String(value ?? '')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {mode === 'view' && onNavigate && (
              <p className="text-[10px] text-gray-500 italic pt-0.5">Click icon to view details</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
