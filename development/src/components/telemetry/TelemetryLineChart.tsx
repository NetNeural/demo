'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { extractMetricValue } from '@/lib/telemetry-utils'
import { useDateFormatter } from '@/hooks/useDateFormatter'
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

// Color palette for multi-device lines
const DEVICE_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
]

interface TelemetryLineChartProps {
  deviceId?: string
  organizationId?: string
  metric: string
  metricLabel?: string
  timeRange?: '1h' | '6h' | '24h' | '7d' | '30d'
  unit?: string
  height?: number
  /** Map of device_id → device_name for multi-device legend labels */
  deviceNames?: Record<string, string>
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
  height = 300,
  deviceNames = {},
}: TelemetryLineChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [chartData, setChartData] = useState<Record<string, any>[]>([])
  const [deviceIds, setDeviceIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { fmt } = useDateFormatter()
  const supabase = createClient()

  const isMultiDevice = !deviceId && !!organizationId

  const fetchTelemetryData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const hours = TIME_RANGE_HOURS[timeRange] || 24
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('device_telemetry_history')
        .select('device_id, device_timestamp, received_at, telemetry')
        .gte('received_at', startTime)
        .order('received_at', { ascending: true })

      if (deviceId) {
        query = query.eq('device_id', deviceId)
      }

      if (organizationId) {
        query = query.eq('organization_id', organizationId)
      }

      query = query.limit(1000)

      const { data: telemetryData, error: fetchError } = await query

      if (fetchError) {
        console.error('[Telemetry Chart] Fetch error:', fetchError)
        setError('Failed to load telemetry data')
        return
      }

      if (!telemetryData || telemetryData.length === 0) {
        setChartData([])
        setDeviceIds([])
        return
      }

      if (isMultiDevice) {
        // Group data by timestamp, with one key per device
        const timeMap = new Map<string, Record<string, number | string>>()
        const seenDevices = new Set<string>()

        for (const item of telemetryData) {
          const value = extractMetricValue(item.telemetry as Record<string, unknown>, metric)
          if (value === null) continue

          const ts = item.device_timestamp || item.received_at
          const timeKey = fmt.dateTime(ts)
          const devId = item.device_id as string
          seenDevices.add(devId)

          if (!timeMap.has(timeKey)) {
            timeMap.set(timeKey, { timestamp: timeKey })
          }
          timeMap.get(timeKey)![devId] = parseFloat(String(value))
        }

        setDeviceIds(Array.from(seenDevices))
        setChartData(Array.from(timeMap.values()))
      } else {
        // Single device mode — flat array
        const processed = telemetryData
          .map((item: { device_timestamp: string | null; received_at: string; telemetry: Record<string, unknown> }) => {
            const value = extractMetricValue(item.telemetry, metric)
            if (value === null) return null
            const ts = item.device_timestamp || item.received_at
            return {
              timestamp: fmt.dateTime(ts),
              value: parseFloat(String(value)),
            }
          })
          .filter(Boolean)

        setDeviceIds([])
        setChartData(processed)
      }
    } catch (err) {
      console.error('[Telemetry Chart] Error:', err)
      setError(`Failed to load ${metricLabel || metric} data`)
    } finally {
      setLoading(false)
    }
  }, [deviceId, organizationId, metric, timeRange, isMultiDevice, supabase])

  useEffect(() => {
    fetchTelemetryData()
  }, [fetchTelemetryData])

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-gray-500">No telemetry data available</p>
      </div>
    )
  }

  const getDeviceLabel = (devId: string) => deviceNames[devId] || devId.slice(0, 8)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="timestamp"
          tick={{ fontSize: 11 }}
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
          formatter={(value: number | undefined, name: string | undefined) => {
            if (value === undefined || name === undefined) return ['N/A', name || 'Unknown']
            const label = isMultiDevice ? getDeviceLabel(name) : (metricLabel || metric)
            return [`${value}${unit}`, label]
          }}
        />
        {isMultiDevice && deviceIds.length > 1 && <Legend formatter={(value) => getDeviceLabel(value)} />}
        {isMultiDevice ? (
          deviceIds.map((devId, idx) => (
            <Line
              key={devId}
              type="monotone"
              dataKey={devId}
              stroke={DEVICE_COLORS[idx % DEVICE_COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))
        ) : (
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
