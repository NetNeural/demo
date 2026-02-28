'use client'

/**
 * HeatmapOverlay — HTML5 Canvas overlay that renders an interpolated heatmap
 * on the facility map based on device telemetry readings.
 * Uses inverse distance weighting (IDW) for spatial interpolation.
 */

import { useRef, useEffect, useMemo } from 'react'
import type { DeviceMapPlacement } from '@/types/facility-map'

/** Color stops for the heatmap gradient (blue → green → yellow → red) */
const GRADIENT_STOPS: Array<[number, [number, number, number]]> = [
  [0.0, [59, 130, 246]],   // blue
  [0.25, [34, 197, 94]],   // green
  [0.5, [234, 179, 8]],    // yellow
  [0.75, [249, 115, 22]],  // orange
  [1.0, [239, 68, 68]],    // red
]

function interpolateColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t))
  for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
    const [t0, c0] = GRADIENT_STOPS[i]!
    const [t1, c1] = GRADIENT_STOPS[i + 1]!
    if (clamped >= t0 && clamped <= t1) {
      const f = (clamped - t0) / (t1 - t0)
      return [
        Math.round(c0[0] + f * (c1[0] - c0[0])),
        Math.round(c0[1] + f * (c1[1] - c0[1])),
        Math.round(c0[2] + f * (c1[2] - c0[2])),
      ]
    }
  }
  return GRADIENT_STOPS[GRADIENT_STOPS.length - 1]![1]
}

interface HeatmapPoint {
  x: number // 0-100 percent
  y: number // 0-100 percent
  value: number
}

interface HeatmapOverlayProps {
  placements: DeviceMapPlacement[]
  telemetryMap: Record<string, Record<string, unknown>>
  metric: string
  opacity?: number
}

export function HeatmapOverlay({
  placements,
  telemetryMap,
  metric,
  opacity = 0.45,
}: HeatmapOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Extract data points from device placements
  const { points, minVal, maxVal } = useMemo(() => {
    const pts: HeatmapPoint[] = []
    for (const p of placements) {
      const telem = telemetryMap[p.device_id]
      if (!telem) continue
      const raw = telem[metric]
      const num = typeof raw === 'number' ? raw : parseFloat(String(raw))
      if (isNaN(num)) continue
      pts.push({ x: p.x_percent, y: p.y_percent, value: num })
    }
    if (pts.length === 0) return { points: pts, minVal: 0, maxVal: 1 }
    let min = pts[0]!.value
    let max = pts[0]!.value
    for (const p of pts) {
      if (p.value < min) min = p.value
      if (p.value > max) max = p.value
    }
    // Add small buffer so single-point maps still work
    if (min === max) { min -= 1; max += 1 }
    return { points: pts, minVal: min, maxVal: max }
  }, [placements, telemetryMap, metric])

  // Render heatmap on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || points.length === 0) return

    const RES = 80 // grid resolution (low for performance)
    canvas.width = RES
    canvas.height = RES
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.createImageData(RES, RES)
    const data = imageData.data

    const power = 2.5 // IDW exponent
    const range = maxVal - minVal

    for (let py = 0; py < RES; py++) {
      for (let px = 0; px < RES; px++) {
        const gx = (px / RES) * 100
        const gy = (py / RES) * 100

        let numerator = 0
        let denominator = 0
        let tooClose = false
        let closestVal = 0

        for (const pt of points) {
          const dx = gx - pt.x
          const dy = gy - pt.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 0.5) {
            tooClose = true
            closestVal = pt.value
            break
          }
          const w = 1 / Math.pow(dist, power)
          numerator += w * pt.value
          denominator += w
        }

        const val = tooClose ? closestVal : numerator / denominator
        const t = (val - minVal) / range
        const [r, g, b] = interpolateColor(t)

        const idx = (py * RES + px) * 4
        data[idx] = r
        data[idx + 1] = g
        data[idx + 2] = b
        // Fade out near edges and far from any device
        const edgeDist = Math.min(gx, gy, 100 - gx, 100 - gy) / 10
        const edgeFade = Math.min(1, edgeDist)
        data[idx + 3] = Math.round(255 * edgeFade)
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }, [points, minVal, maxVal])

  if (points.length < 2) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{
        width: '100%',
        height: '100%',
        opacity,
        zIndex: 4,
        imageRendering: 'auto',
      }}
    />
  )
}

/** Collect all unique metric keys from a telemetry map */
export function getAvailableMetrics(
  telemetryMap: Record<string, Record<string, unknown>>
): string[] {
  const keys = new Set<string>()
  for (const telem of Object.values(telemetryMap)) {
    for (const key of Object.keys(telem)) {
      const val = telem[key]
      if (typeof val === 'number' || (typeof val === 'string' && !isNaN(parseFloat(val)))) {
        keys.add(key)
      }
    }
  }
  return Array.from(keys).sort()
}

/** Format a metric key for display */
export function formatMetricLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Simple gradient legend bar */
export function HeatmapLegend({
  min,
  max,
  metric,
}: {
  min: number
  max: number
  metric: string
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="font-medium">{formatMetricLabel(metric)}</span>
      <span>{min.toFixed(1)}</span>
      <div
        className="h-2.5 w-20 rounded-full"
        style={{
          background: 'linear-gradient(to right, #3b82f6, #22c55e, #eab308, #f97316, #ef4444)',
        }}
      />
      <span>{max.toFixed(1)}</span>
    </div>
  )
}
