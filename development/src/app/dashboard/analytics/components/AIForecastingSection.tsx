'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  BatteryWarning,
  AlertTriangle,
  Zap,
  ThermometerSun,
  Droplets,
  Signal,
} from 'lucide-react'
import type { TimeRange } from '../types/analytics.types'
import { getTimeRangeHours } from '../types/analytics.types'
import { extractMetricValue } from '@/lib/telemetry-utils'
import { FeatureGate } from '@/components/FeatureGate'

interface AIForecastingSectionProps {
  organizationId: string
  timeRange: TimeRange
}

interface MetricForecast {
  metric: string
  label: string
  icon: typeof ThermometerSun
  unit: string
  currentAvg: number
  predictedAvg: number
  trend: 'rising' | 'falling' | 'stable'
  trendPercent: number
  confidence: number // 0-1
  anomalyCount: number
  anomalyDevices: string[]
}

interface BatteryPrediction {
  deviceName: string
  deviceId: string
  currentBattery: number
  depletionHours: number | null // null = stable/charging
  ratePerHour: number
}

interface TelemetryRow {
  device_id: string
  received_at: string
  telemetry: Record<string, unknown>
}

// Simple linear regression: returns slope, intercept, R²
function linearRegression(points: { x: number; y: number }[]): {
  slope: number
  intercept: number
  r2: number
} {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y || 0, r2: 0 }

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0,
    sumY2 = 0
  for (const p of points) {
    sumX += p.x
    sumY += p.y
    sumXY += p.x * p.y
    sumX2 += p.x * p.x
    sumY2 += p.y * p.y
  }

  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 }

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  // R² calculation
  const yMean = sumY / n
  let ssRes = 0,
    ssTot = 0
  for (const p of points) {
    const predicted = slope * p.x + intercept
    ssRes += (p.y - predicted) ** 2
    ssTot += (p.y - yMean) ** 2
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot

  return { slope, intercept, r2: Math.max(0, r2) }
}

const METRICS = [
  {
    key: 'temperature',
    label: 'Temperature',
    icon: ThermometerSun,
    unit: '°C',
  },
  { key: 'battery', label: 'Battery', icon: BatteryWarning, unit: '%' },
  { key: 'rssi', label: 'Signal Strength', icon: Signal, unit: 'dBm' },
  { key: 'humidity', label: 'Humidity', icon: Droplets, unit: '%' },
]

export function AIForecastingSection({
  organizationId,
  timeRange,
}: AIForecastingSectionProps) {
  const [loading, setLoading] = useState(true)
  const [telemetryData, setTelemetryData] = useState<TelemetryRow[]>([])
  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({})
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)

    try {
      const hours = getTimeRangeHours(timeRange)
      const startTime = new Date(
        Date.now() - hours * 60 * 60 * 1000
      ).toISOString()

      const [telResult, devResult] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('device_telemetry_history')
          .select('device_id, received_at, telemetry')
          .eq('organization_id', organizationId)
          .gte('received_at', startTime)
          .order('received_at', { ascending: true })
          .limit(2000),
        supabase
          .from('devices')
          .select('id, name')
          .eq('organization_id', organizationId),
      ])

      // Handle telemetry table not existing (400 error) gracefully
      if (telResult.error) {
        console.warn(
          '[AI Forecasting] Telemetry query failed:',
          telResult.error.message,
          telResult.error.code
        )
        // Continue with empty data rather than breaking the page
        setTelemetryData([])
      } else if (telResult.data) {
        setTelemetryData(telResult.data as TelemetryRow[])
      }

      if (devResult.data) {
        const names: Record<string, string> = {}
        for (const d of devResult.data) names[d.id] = d.name
        setDeviceNames(names)
      }
    } catch (err) {
      console.error('[AI Forecasting] Unexpected error:', err)
      // Set empty data to prevent further errors
      setTelemetryData([])
    } finally {
      setLoading(false)
    }
  }, [organizationId, timeRange, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Compute forecasts from telemetry data
  const metricForecasts = useMemo((): MetricForecast[] => {
    if (telemetryData.length === 0) return []

    const hours = getTimeRangeHours(timeRange)
    const now = Date.now()
    const startMs = now - hours * 60 * 60 * 1000

    return METRICS.map(({ key, label, icon, unit }) => {
      // Extract all values with timestamps
      const points: { x: number; y: number; deviceId: string }[] = []
      for (const row of telemetryData) {
        const num = extractMetricValue(
          row.telemetry as Record<string, unknown>,
          key
        )
        if (num === null) continue
        if (isNaN(num)) continue
        const t = new Date(row.received_at).getTime()
        points.push({
          x: (t - startMs) / (1000 * 60 * 60),
          y: num,
          deviceId: row.device_id,
        })
      }

      if (points.length === 0) {
        return {
          metric: key,
          label,
          icon,
          unit,
          currentAvg: 0,
          predictedAvg: 0,
          trend: 'stable' as const,
          trendPercent: 0,
          confidence: 0,
          anomalyCount: 0,
          anomalyDevices: [],
        }
      }

      // Linear regression on all points
      const regPoints = points.map((p) => ({ x: p.x, y: p.y }))
      const { slope, intercept, r2 } = linearRegression(regPoints)

      // Current average (last 10% of data)
      const recentCutoff = points.length * 0.9
      const recentValues = points
        .slice(Math.floor(recentCutoff))
        .map((p) => p.y)
      const currentAvg =
        recentValues.reduce((a, b) => a + b, 0) / recentValues.length

      // Predicted: extrapolate forward by same time range
      const predictedAvg = slope * (hours * 2) + intercept

      // Trend
      const changePercent =
        currentAvg !== 0
          ? ((predictedAvg - currentAvg) / Math.abs(currentAvg)) * 100
          : 0
      const trend: 'rising' | 'falling' | 'stable' =
        Math.abs(changePercent) < 2
          ? 'stable'
          : changePercent > 0
            ? 'rising'
            : 'falling'

      // Anomaly detection: values > 2σ from mean
      const allValues = points.map((p) => p.y)
      const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length
      const stdDev = Math.sqrt(
        allValues.reduce((s, v) => s + (v - mean) ** 2, 0) / allValues.length
      )
      const threshold = stdDev * 2

      const anomalousDevices = new Set<string>()
      let anomalyCount = 0
      for (const p of points) {
        if (Math.abs(p.y - mean) > threshold && threshold > 0) {
          anomalyCount++
          anomalousDevices.add(p.deviceId)
        }
      }

      return {
        metric: key,
        label,
        icon,
        unit,
        currentAvg,
        predictedAvg,
        trend,
        trendPercent: Math.abs(changePercent),
        confidence: r2,
        anomalyCount,
        anomalyDevices: Array.from(anomalousDevices),
      }
    }).filter((f) => f.confidence > 0 || f.currentAvg !== 0)
  }, [telemetryData, timeRange])

  // Battery depletion predictions
  const batteryPredictions = useMemo((): BatteryPrediction[] => {
    if (telemetryData.length === 0) return []

    const hours = getTimeRangeHours(timeRange)
    const startMs = Date.now() - hours * 60 * 60 * 1000

    // Group battery readings by device
    const byDevice = new Map<string, { x: number; y: number }[]>()
    for (const row of telemetryData) {
      const num = extractMetricValue(
        row.telemetry as Record<string, unknown>,
        'battery'
      )
      if (num === null) continue
      if (isNaN(num)) continue

      const t = new Date(row.received_at).getTime()
      const arr = byDevice.get(row.device_id) || []
      arr.push({ x: (t - startMs) / (1000 * 60 * 60), y: num })
      byDevice.set(row.device_id, arr)
    }

    const predictions: BatteryPrediction[] = []
    for (const [deviceId, points] of byDevice) {
      if (points.length < 3) continue

      const { slope } = linearRegression(points)
      const lastPoint = points[points.length - 1]
      const currentBattery = lastPoint?.y ?? 0

      let depletionHours: number | null = null
      if (slope < -0.05) {
        // Battery is draining — calculate hours until 0
        depletionHours = Math.max(0, currentBattery / Math.abs(slope))
      }

      predictions.push({
        deviceName: deviceNames[deviceId] || deviceId.slice(0, 8),
        deviceId,
        currentBattery,
        depletionHours,
        ratePerHour: slope,
      })
    }

    // Sort: fastest draining first
    return predictions
      .filter((p) => p.depletionHours !== null)
      .sort(
        (a, b) =>
          (a.depletionHours ?? Infinity) - (b.depletionHours ?? Infinity)
      )
  }, [telemetryData, deviceNames, timeRange])

  const TrendIcon = ({ trend }: { trend: 'rising' | 'falling' | 'stable' }) => {
    if (trend === 'rising')
      return <TrendingUp className="h-4 w-4 text-green-500" />
    if (trend === 'falling')
      return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-muted-foreground" />
  }

  if (loading) {
    return (
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Brain className="h-5 w-5 text-purple-500" />
          AI Insights & Forecasting
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Brain className="h-5 w-5 text-purple-500" />
        AI Insights & Forecasting
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Metric Trend Forecasts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-blue-500" />
              Trend Predictions
            </CardTitle>
            <CardDescription>
              Where your fleet metrics are heading based on recent data
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metricForecasts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Not enough telemetry data for predictions
              </p>
            ) : (
              <div className="space-y-3">
                {metricForecasts.map((forecast) => {
                  const Icon = forecast.icon
                  return (
                    <div
                      key={forecast.metric}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {forecast.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Now: {forecast.currentAvg.toFixed(1)}
                            {forecast.unit}
                            {' → '}
                            Predicted: {forecast.predictedAvg.toFixed(1)}
                            {forecast.unit}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {forecast.anomalyCount > 0 && (
                          <Badge
                            variant="destructive"
                            className="text-xs"
                            title={`${forecast.anomalyCount} anomalous readings from ${forecast.anomalyDevices.length} device(s)`}
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {forecast.anomalyCount}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1">
                          <TrendIcon trend={forecast.trend} />
                          <span
                            className={`text-xs font-medium ${
                              forecast.trend === 'rising'
                                ? 'text-green-600'
                                : forecast.trend === 'falling'
                                  ? 'text-red-600'
                                  : 'text-muted-foreground'
                            }`}
                          >
                            {forecast.trendPercent.toFixed(1)}%
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs"
                          title={`R² = ${forecast.confidence.toFixed(2)} — ${forecast.confidence > 0.7 ? 'high' : forecast.confidence > 0.4 ? 'moderate' : 'low'} confidence`}
                        >
                          {forecast.confidence > 0.7
                            ? '●'
                            : forecast.confidence > 0.4
                              ? '◐'
                              : '○'}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
                <p className="pt-1 text-center text-[10px] text-muted-foreground">
                  ● high confidence · ◐ moderate · ○ low — based on linear
                  regression (R²)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Battery Depletion Forecast — Enterprise only (predictive_ai) */}
        <FeatureGate feature="predictive_ai" showUpgradePrompt>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BatteryWarning className="h-4 w-4 text-yellow-500" />
              Battery Depletion Forecast
            </CardTitle>
            <CardDescription>
              Devices predicted to run low based on current drain rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            {batteryPredictions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No battery drain detected — fleet batteries are stable
              </p>
            ) : (
              <div className="max-h-[240px] space-y-2 overflow-y-auto">
                {batteryPredictions.slice(0, 8).map((pred) => {
                  const isUrgent =
                    pred.depletionHours !== null && pred.depletionHours < 48
                  const isCritical =
                    pred.depletionHours !== null && pred.depletionHours < 12
                  return (
                    <div
                      key={pred.deviceId}
                      className={`flex items-center justify-between rounded-lg border p-3 ${
                        isCritical
                          ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20'
                          : isUrgent
                            ? 'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20'
                            : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {pred.deviceName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Currently {pred.currentBattery.toFixed(0)}% · draining{' '}
                          {Math.abs(pred.ratePerHour).toFixed(2)}%/hr
                        </p>
                      </div>
                      <Badge
                        variant={
                          isCritical
                            ? 'destructive'
                            : isUrgent
                              ? 'secondary'
                              : 'outline'
                        }
                        className="ml-2 flex-shrink-0 text-xs"
                      >
                        {pred.depletionHours !== null
                          ? pred.depletionHours < 1
                            ? '< 1 hr'
                            : `~${Math.round(pred.depletionHours)} hrs`
                          : 'Stable'}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
        </FeatureGate>
      </div>
    </div>
  )
}
