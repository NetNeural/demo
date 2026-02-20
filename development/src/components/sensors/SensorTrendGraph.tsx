'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { useMemo } from 'react'
import type {
  SensorTrendPoint,
  SensorThreshold,
  TimeRange,
} from '@/types/sensor-details'

interface SensorTrendGraphProps {
  data: SensorTrendPoint[]
  sensorType: string
  threshold: SensorThreshold | null
  timeRange: TimeRange
}

export function SensorTrendGraph({
  data,
  sensorType,
  threshold,
  timeRange,
}: SensorTrendGraphProps) {
  // Process data for visualization
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []

    // Sort by timestamp
    const sorted = [...data].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    return sorted.map((point) => ({
      timestamp: point.timestamp,
      value: point.value,
      quality: point.quality,
      formattedTime: formatTimestamp(point.timestamp, timeRange),
    }))
  }, [data, timeRange])

  // Calculate Y-axis range
  const yAxisRange = useMemo(() => {
    if (chartData.length === 0) return { min: 0, max: 100 }

    const values = chartData.map((d) => d.value)
    const dataMin = Math.min(...values)
    const dataMax = Math.max(...values)

    // Include threshold values in range calculation
    let rangeMin = dataMin
    let rangeMax = dataMax

    if (threshold) {
      if (threshold.min_value !== null)
        rangeMin = Math.min(rangeMin, threshold.min_value)
      if (threshold.max_value !== null)
        rangeMax = Math.max(rangeMax, threshold.max_value)
      if (threshold.critical_min !== null)
        rangeMin = Math.min(rangeMin, threshold.critical_min)
      if (threshold.critical_max !== null)
        rangeMax = Math.max(rangeMax, threshold.critical_max)
    }

    // Add 10% padding
    const padding = (rangeMax - rangeMin) * 0.1
    return {
      min: Math.floor(rangeMin - padding),
      max: Math.ceil(rangeMax + padding),
    }
  }, [chartData, threshold])

  // Simple SVG-based chart (Stage 1 - basic implementation)
  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <div className="flex h-[300px] items-center justify-center text-muted-foreground">
          No data available for selected time range
        </div>
      )
    }

    const width = 800
    const height = 300
    const padding = { top: 20, right: 20, bottom: 40, left: 60 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    // Scale functions
    const xScale = (index: number) => {
      return (index / (chartData.length - 1)) * chartWidth + padding.left
    }

    const yScale = (value: number) => {
      const normalized =
        (value - yAxisRange.min) / (yAxisRange.max - yAxisRange.min)
      return height - padding.bottom - normalized * chartHeight
    }

    // Generate path for line chart
    const pathData = chartData
      .map((point, index) => {
        const x = xScale(index)
        const y = yScale(point.value)
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')

    // Generate threshold lines
    const thresholdLines = []
    if (threshold) {
      if (threshold.max_value !== null) {
        thresholdLines.push({
          y: yScale(threshold.max_value),
          label: 'Max',
          color: '#f59e0b',
          value: threshold.max_value,
        })
      }
      if (threshold.min_value !== null) {
        thresholdLines.push({
          y: yScale(threshold.min_value),
          label: 'Min',
          color: '#f59e0b',
          value: threshold.min_value,
        })
      }
      if (threshold.critical_max !== null) {
        thresholdLines.push({
          y: yScale(threshold.critical_max),
          label: 'Critical Max',
          color: '#ef4444',
          value: threshold.critical_max,
        })
      }
      if (threshold.critical_min !== null) {
        thresholdLines.push({
          y: yScale(threshold.critical_min),
          label: 'Critical Min',
          color: '#ef4444',
          value: threshold.critical_min,
        })
      }
    }

    return (
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="mx-auto">
          {/* Grid lines */}
          <g>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + ratio * chartHeight
              return (
                <line
                  key={ratio}
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              )
            })}
          </g>

          {/* Threshold lines */}
          {thresholdLines.map((line, index) => (
            <g key={index}>
              <line
                x1={padding.left}
                y1={line.y}
                x2={width - padding.right}
                y2={line.y}
                stroke={line.color}
                strokeWidth="2"
                strokeDasharray="8 4"
              />
              <text
                x={width - padding.right - 5}
                y={line.y - 5}
                textAnchor="end"
                fontSize="12"
                fill={line.color}
              >
                {line.label}: {line.value.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Data line */}
          <path
            d={pathData}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Data points */}
          {chartData.map((point, index) => (
            <circle
              key={index}
              cx={xScale(index)}
              cy={yScale(point.value)}
              r="4"
              fill={point.quality && point.quality < 70 ? '#ef4444' : '#3b82f6'}
              stroke="white"
              strokeWidth="2"
            />
          ))}

          {/* Y-axis */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            stroke="#6b7280"
            strokeWidth="2"
          />

          {/* Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const value =
              yAxisRange.min + ratio * (yAxisRange.max - yAxisRange.min)
            const y = padding.top + (1 - ratio) * chartHeight
            return (
              <text
                key={ratio}
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
                fill="#6b7280"
              >
                {value.toFixed(1)}
              </text>
            )
          })}

          {/* X-axis */}
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#6b7280"
            strokeWidth="2"
          />

          {/* X-axis labels (show first, middle, last) */}
          {[0, Math.floor(chartData.length / 2), chartData.length - 1].map(
            (index) => {
              if (index >= chartData.length) return null
              const point = chartData[index]
              if (!point) return null
              return (
                <text
                  key={index}
                  x={xScale(index)}
                  y={height - padding.bottom + 20}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#6b7280"
                >
                  {point.formattedTime}
                </text>
              )
            }
          )}
        </svg>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {sensorType.charAt(0).toUpperCase() + sensorType.slice(1)} Trend
        </CardTitle>
        <CardDescription>
          {getTimeRangeDescription(timeRange)} • {chartData.length} readings
        </CardDescription>
      </CardHeader>
      <CardContent>{renderChart()}</CardContent>
    </Card>
  )
}

// Helper functions
function formatTimestamp(timestamp: string, timeRange: TimeRange): string {
  const date = new Date(timestamp)

  if (timeRange === '48h') {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } else if (timeRange === '7d') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

function getTimeRangeDescription(timeRange: TimeRange): string {
  const descriptions: Record<TimeRange, string> = {
    '48h': 'Last 48 Hours',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    custom: 'Custom Range',
  }
  return descriptions[timeRange] || 'Unknown Range'
}
