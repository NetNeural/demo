'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import type { SensorReading, SensorStatistics, SensorThreshold, Device } from '@/types/sensor-details'
import { useDateFormatter } from '@/hooks/useDateFormatter'

interface SensorOverviewCardProps {
  latestReading: SensorReading | null
  statistics: SensorStatistics | null
  threshold: SensorThreshold | null
  device: Device
  sensorType: string
}

export function SensorOverviewCard({
  latestReading,
  statistics,
  threshold,
  sensorType,
}: SensorOverviewCardProps) {
  // Calculate alert status based on threshold
  const getAlertStatus = () => {
    if (!latestReading || !threshold || !threshold.alert_enabled) {
      return null
    }

    const value = latestReading.value

    // Check critical thresholds
    if (threshold.critical_min !== null && value < threshold.critical_min) {
      return { level: 'critical', message: 'Critical: Below minimum', color: 'destructive' } as const
    }
    if (threshold.critical_max !== null && value > threshold.critical_max) {
      return { level: 'critical', message: 'Critical: Above maximum', color: 'destructive' } as const
    }

    // Check warning thresholds
    if (threshold.min_value !== null && value < threshold.min_value) {
      return { level: 'warning', message: 'Warning: Below threshold', color: 'secondary' } as const
    }
    if (threshold.max_value !== null && value > threshold.max_value) {
      return { level: 'warning', message: 'Warning: Above threshold', color: 'secondary' } as const
    }

    return { level: 'normal', message: 'Normal', color: 'default' } as const
  }

  const alertStatus = getAlertStatus()

  // Calculate trend from statistics
  const getTrend = () => {
    if (!statistics || !latestReading) return null

    const currentValue = latestReading.value
    const avgValue = statistics.avg

    const percentChange = ((currentValue - avgValue) / avgValue) * 100

    if (Math.abs(percentChange) < 1) {
      return { direction: 'stable', change: 0 }
    }

    return {
      direction: percentChange > 0 ? 'up' : 'down',
      change: Math.abs(percentChange),
    }
  }

  const trend = getTrend()
  const { fmt } = useDateFormatter()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>{sensorType.charAt(0).toUpperCase() + sensorType.slice(1)} Overview</span>
          {alertStatus && alertStatus.level !== 'normal' && (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Reading */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              {latestReading ? latestReading.value.toFixed(2) : '--'}
            </span>
            <span className="text-muted-foreground">
              {latestReading?.unit || ''}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {latestReading
              ? `Updated ${fmt.timeAgo(latestReading.timestamp)}`
              : 'No recent data'}
          </p>
        </div>

        {/* Alert Status */}
        {alertStatus && (
          <div className="flex items-center gap-2">
            <Badge variant={alertStatus.color}>
              {alertStatus.message}
            </Badge>
          </div>
        )}

        {/* Trend Indicator */}
        {trend && (
          <div className="flex items-center gap-2 text-sm">
            {trend.direction === 'up' && (
              <>
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-muted-foreground">
                  {trend.change.toFixed(1)}% above average
                </span>
              </>
            )}
            {trend.direction === 'down' && (
              <>
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-muted-foreground">
                  {trend.change.toFixed(1)}% below average
                </span>
              </>
            )}
            {trend.direction === 'stable' && (
              <>
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="text-muted-foreground">Stable</span>
              </>
            )}
          </div>
        )}

        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Min</p>
              <p className="text-sm font-medium">
                {statistics.min.toFixed(2)} {latestReading?.unit || ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max</p>
              <p className="text-sm font-medium">
                {statistics.max.toFixed(2)} {latestReading?.unit || ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="text-sm font-medium">
                {statistics.avg.toFixed(2)} {latestReading?.unit || ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Readings</p>
              <p className="text-sm font-medium">{statistics.readings_count}</p>
            </div>
          </div>
        )}

        {/* Threshold Configuration */}
        {threshold && threshold.alert_enabled && (
          <div className="pt-3 border-t space-y-2">
            <p className="text-xs font-medium">Configured Thresholds</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {threshold.min_value !== null && (
                <div>
                  <span className="text-muted-foreground">Min: </span>
                  <span className="font-medium">{threshold.min_value}</span>
                </div>
              )}
              {threshold.max_value !== null && (
                <div>
                  <span className="text-muted-foreground">Max: </span>
                  <span className="font-medium">{threshold.max_value}</span>
                </div>
              )}
              {threshold.critical_min !== null && (
                <div>
                  <span className="text-destructive">Critical Min: </span>
                  <span className="font-medium">{threshold.critical_min}</span>
                </div>
              )}
              {threshold.critical_max !== null && (
                <div>
                  <span className="text-destructive">Critical Max: </span>
                  <span className="font-medium">{threshold.critical_max}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Device Health Indicator */}
        <div className="pt-3 border-t flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Data Quality</span>
          <Badge variant={latestReading && latestReading.quality && latestReading.quality > 80 ? 'default' : 'secondary'}>
            {latestReading && latestReading.quality !== null ? `${latestReading.quality}%` : 'Unknown'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
