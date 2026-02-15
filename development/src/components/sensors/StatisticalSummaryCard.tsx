'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMemo } from 'react'
import type { Device } from '@/types/sensor-details'

interface TelemetryReading {
  telemetry: {
    value?: number
    [key: string]: unknown
  }
  device_timestamp: string | null
  received_at: string
}

interface StatisticalSummaryCardProps {
  device: Device
  telemetryReadings: TelemetryReading[]
}

export function StatisticalSummaryCard({ device, telemetryReadings }: StatisticalSummaryCardProps) {
  const stats = useMemo(() => {
    if (telemetryReadings.length === 0) {
      return { avg: 0, min: 0, max: 0, range: 0, count: 0, quality: 0 }
    }

    const values = telemetryReadings
      .map(r => r.telemetry.value)
      .filter((v): v is number => v != null)

    if (values.length === 0) {
      return { avg: 0, min: 0, max: 0, range: 0, count: 0, quality: 0 }
    }

    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length
    const range = max - min

    // Calculate standard deviation
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
    const stddev = Math.sqrt(variance)

    // Data quality: percentage of non-null readings
    const quality = (values.length / telemetryReadings.length) * 100

    return { avg, min, max, range, stddev, count: values.length, quality }
  }, [telemetryReadings])

  return (
    <Card>
      <CardHeader>
        <CardTitle>📈 Statistical Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Average</p>
            <p className="text-2xl font-bold">{stats.avg.toFixed(1)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Min</p>
            <p className="text-2xl font-bold">{stats.min.toFixed(1)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Max</p>
            <p className="text-2xl font-bold">{stats.max.toFixed(1)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Range</p>
            <p className="text-2xl font-bold">{stats.range.toFixed(1)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
          {stats.stddev != null && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Std Dev</p>
              <p className="text-lg font-semibold">±{stats.stddev.toFixed(2)}</p>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Readings</p>
            <p className="text-lg font-semibold">{stats.count.toLocaleString()}</p>
          </div>
          <div className="space-y-1 col-span-2">
            <p className="text-xs text-muted-foreground">Data Quality</p>
            <p className="text-lg font-semibold">{stats.quality.toFixed(1)}% complete</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
