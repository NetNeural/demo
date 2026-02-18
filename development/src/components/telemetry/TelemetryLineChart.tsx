'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Loader2 } from 'lucide-react'

interface TelemetryDataPoint {
  timestamp: string
  value: number
  integration_type?: string
}

interface TelemetryLineChartProps {
  deviceId?: string
  organizationId?: string
  metric: string
  metricLabel?: string
  timeRange?: '1h' | '6h' | '24h' | '7d' | '30d'
  unit?: string
  showIntegrationColors?: boolean
  height?: number
}

const TIME_RANGE_HOURS: Record<string, number> = {
  '1h': 1,
  '6h': 6,
  '24h': 24,
  '7d': 168,
  '30d': 720,
}

export function TelemetryLineChart({
  deviceId,
  organizationId,
  metric,
  metricLabel,
  timeRange = '24h',
  unit = '',
  showIntegrationColors = false,
  height = 300,
}: TelemetryLineChartProps) {
  const [data, setData] = useState<TelemetryDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchTelemetryData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const hours = TIME_RANGE_HOURS[timeRange] || 24
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('device_telemetry_history')
        .select('device_timestamp, received_at, telemetry')
        .gte('received_at', startTime)
        .order('received_at', { ascending: true })

      if (deviceId) {
        query = query.eq('device_id', deviceId)
      }

      if (organizationId) {
        // device_telemetry_history has organization_id directly — no subquery needed
        query = query.eq('organization_id', organizationId)
      }

      // Limit to prevent loading too many rows
      query = query.limit(500)

      const { data: telemetryData, error: fetchError } = await query

      if (fetchError) {
        console.error('[Telemetry Chart] Fetch error:', fetchError)
        setError('Failed to load telemetry data')
        return
      }

      if (!telemetryData || telemetryData.length === 0) {
        setData([])
        return
      }

      // Extract metric values from telemetry JSON
      const processedData: TelemetryDataPoint[] = telemetryData
        .map((item: { device_timestamp: string | null; received_at: string; telemetry: Record<string, unknown> }) => {
          const value = item.telemetry?.[metric]
          if (value === undefined || value === null) return null

          const ts = item.device_timestamp || item.received_at
          return {
            timestamp: new Date(ts).toLocaleString(),
            value: parseFloat(String(value)),
          }
        })
        .filter(Boolean) as TelemetryDataPoint[]

      setData(processedData)
    } catch (err) {
      console.error('[Telemetry Chart] Error:', err)
      setError(`Failed to load ${metricLabel || metric} data`)
    } finally {
      setLoading(false)
    }
  }, [deviceId, organizationId, metric, timeRange, supabase])

  useEffect(() => {
    fetchTelemetryData()
  }, [fetchTelemetryData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="text-sm text-gray-500">No telemetry data available</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="timestamp"
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis
          label={{ value: unit ? `${metricLabel || metric} (${unit})` : metricLabel || metric, angle: -90, position: 'insideLeft' }}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          labelFormatter={(label) => `Time: ${label}`}
          formatter={(value: number) => [`${value}${unit}`, metricLabel || metric]}
        />
        {showIntegrationColors && <Legend />}
        <Line
          type="monotone"
          dataKey="value"
          stroke={showIntegrationColors ? undefined : '#3b82f6'}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
