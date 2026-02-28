'use client'

/**
 * HeatmapOverlay — Renders an HTML5 Canvas heatmap overlay on the facility map.
 * Uses inverse distance weighting (IDW) to interpolate between device positions,
 * producing a smooth color gradient (blue → green → yellow → red).
 *
 * Supports selecting which telemetry metric to visualize and a color legend bar.
 */

import { useEffect, useRef, useMemo } from 'react'
import type { DeviceMapPlacement } from '@/types/facility-map'
import { extractMetricValue } from '@/lib/telemetry-utils'

interface HeatmapOverlayProps {
  placements: DeviceMapPlacement[]
  telemetryMap: Record<string, Record<string, unknown>>
  /** The telemetry key to visualize (e.g. 'temperature', 'humidity') */
  metricKey: string
  /** Canvas width in px (rendered image content area) */
  width: number
  /** Canvas height in px (rendered image content area) */
  height: number
  /** Opacity of the heatmap overlay (0-1) */
  opacity?: number
}

/** IDW power parameter — higher = more localized influence */
const IDW_POWER = 2
/** Resolution of the heatmap grid (pixels per cell). Lower = smoother but slower */
const CELL_SIZE = 8

/**
 * Map a normalized value (0-1) to a color on the blue → green → yellow → red scale.
 */
function valueToColor(t: number): [number, number, number] {
  // clamp
  const v = Math.max(0, Math.min(1, t))

  let r: number, g: number, b: number
  if (v < 0.25) {
    // blue → cyan
    const f = v / 0.25
    r = 0; g = Math.round(f * 200); b = 255
  } else if (v < 0.5) {
    // cyan → green
    const f = (v - 0.25) / 0.25
    r = 0; g = 200 + Math.round(f * 55); b = Math.round(255 * (1 - f))
  } else if (v < 0.75) {
    // green → yellow
    const f = (v - 0.5) / 0.25
    r = Math.round(255 * f); g = 255; b = 0
  } else {
    // yellow → red
    const f = (v - 0.75) / 0.25
    r = 255; g = Math.round(255 * (1 - f)); b = 0
  }
  return [r, g, b]
}

export function HeatmapOverlay({
  placements,
  telemetryMap,
  metricKey,
  width,
  height,
  opacity = 0.45,
}: HeatmapOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Extract device positions and values for the chosen metric.
  // Uses extractMetricValue to support both flat keys and Golioth sensor format.
  const dataPoints = useMemo(() => {
    const pts: { x: number; y: number; value: number }[] = []
    for (const p of placements) {
      const tele = telemetryMap[p.device_id]
      if (!tele) continue
      const val = extractMetricValue(tele, metricKey)
      if (val === null) continue
      pts.push({
        x: (p.x_percent / 100) * width,
        y: (p.y_percent / 100) * height,
        value: val,
      })
    }
    return pts
  }, [placements, telemetryMap, metricKey, width, height])

  // Compute min/max for normalization
  const { minVal, maxVal } = useMemo(() => {
    if (dataPoints.length === 0) return { minVal: 0, maxVal: 1 }
    let min = Infinity, max = -Infinity
    for (const dp of dataPoints) {
      if (dp.value < min) min = dp.value
      if (dp.value > max) max = dp.value
    }
    if (min === max) { min -= 1; max += 1 }
    return { minVal: min, maxVal: max }
  }, [dataPoints])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dataPoints.length < 2 || width < 10 || height < 10) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width
    canvas.height = height

    const cols = Math.ceil(width / CELL_SIZE)
    const rows = Math.ceil(height / CELL_SIZE)
    const imageData = ctx.createImageData(width, height)
    const data = imageData.data
    const range = maxVal - minVal

    // For each cell, compute IDW-interpolated value
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = col * CELL_SIZE + CELL_SIZE / 2
        const cy = row * CELL_SIZE + CELL_SIZE / 2

        let weightedSum = 0
        let weightTotal = 0

        for (const dp of dataPoints) {
          const dx = cx - dp.x
          const dy = cy - dp.y
          const distSq = dx * dx + dy * dy
          if (distSq < 1) {
            // Exact position
            weightedSum = dp.value
            weightTotal = 1
            break
          }
          const weight = 1 / Math.pow(Math.sqrt(distSq), IDW_POWER)
          weightedSum += weight * dp.value
          weightTotal += weight
        }

        const interpolated = weightTotal > 0 ? weightedSum / weightTotal : 0
        const normalized = (interpolated - minVal) / range
        const [r, g, b] = valueToColor(normalized)

        // Fill the cell in the image data
        for (let py = row * CELL_SIZE; py < Math.min((row + 1) * CELL_SIZE, height); py++) {
          for (let px = col * CELL_SIZE; px < Math.min((col + 1) * CELL_SIZE, width); px++) {
            const idx = (py * width + px) * 4
            data[idx] = r
            data[idx + 1] = g
            data[idx + 2] = b
            data[idx + 3] = 255 // alpha handled by canvas opacity
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }, [dataPoints, width, height, minVal, maxVal])

  if (dataPoints.length < 2 || width < 10 || height < 10) return null

  return (
    <div className="absolute inset-0 z-[3] pointer-events-none">
      <canvas
        ref={canvasRef}
        style={{ width, height, opacity }}
        className="absolute"
      />
      {/* Legend bar */}
      <div className="absolute bottom-1 right-1 z-[4] flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
        <span className="text-[9px] text-blue-300 font-mono">{minVal.toFixed(1)}</span>
        <div
          className="h-2 w-16 rounded-sm"
          style={{
            background: 'linear-gradient(to right, #0000FF, #00C8FF, #00FF00, #FFFF00, #FF0000)',
          }}
        />
        <span className="text-[9px] text-red-300 font-mono">{maxVal.toFixed(1)}</span>
        <span className="text-[8px] text-gray-300 ml-0.5">{metricKey}</span>
      </div>
    </div>
  )
}
