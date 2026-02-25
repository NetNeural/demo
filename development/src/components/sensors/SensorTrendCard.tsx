'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMemo } from 'react'
import type { Device } from '@/types/sensor-details'
import { useDateFormatter } from '@/hooks/useDateFormatter'

interface TelemetryReading {
  telemetry: {
    type?: number
    value?: number
    [key: string]: unknown
  }
  device_timestamp: string | null
  received_at: string
}

interface SensorTrendCardProps {
  device: Device
  telemetryReadings: TelemetryReading[]
}

export function SensorTrendCard({
  device,
  telemetryReadings,
}: SensorTrendCardProps) {
  const { fmt } = useDateFormatter()

  const chartData = useMemo(() => {
    return telemetryReadings
      .slice(0, 100)
      .map((r) => ({
        time: fmt.dateTime(r.device_timestamp || r.received_at),
        value: r.telemetry.value || 0,
      }))
      .reverse()
  }, [telemetryReadings, fmt])

  return (
    <Card>
      <CardHeader>
        <CardTitle>📊 48-Hour Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Showing last {chartData.length} readings
        </p>
        <div className="flex h-64 items-end justify-between gap-1">
          {chartData.slice(-48).map((point, idx) => {
            const maxValue = Math.max(...chartData.map((d) => d.value))
            const height = (point.value / maxValue) * 100
            return (
              <div
                key={idx}
                className="flex-1 cursor-pointer rounded-t bg-blue-500 transition-colors hover:bg-blue-600"
                style={{ height: `${height}%`, minHeight: '2px' }}
                title={`${point.time}: ${point.value.toFixed(1)}`}
              />
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
