'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { edgeFunctions } from '@/lib/edge-functions/client'
import type { AlertStats, AlertDeviceRanking } from '@/lib/edge-functions/api/alerts'

interface AlertsSummaryBarProps {
  alerts: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical'
    acknowledged: boolean
  }>
  onFilterBySeverity?: (severity: string) => void
}

export function AlertsSummaryBar({
  alerts,
  onFilterBySeverity,
}: AlertsSummaryBarProps) {
  const { currentOrganization } = useOrganization()
  const [stats, setStats] = useState<AlertStats | null>(null)
  const [topDevices, setTopDevices] = useState<AlertDeviceRanking[]>([])

  useEffect(() => {
    if (!currentOrganization) return
    edgeFunctions.alerts.stats(currentOrganization.id).then((res) => {
      if (res.success && res.data) {
        setStats(res.data.stats)
        setTopDevices(res.data.topDevices || [])
      }
    })
  }, [currentOrganization])

  const localStats = {
    critical: alerts.filter((a) => a.severity === 'critical' && !a.acknowledged)
      .length,
    high: alerts.filter((a) => a.severity === 'high' && !a.acknowledged).length,
    medium: alerts.filter((a) => a.severity === 'medium' && !a.acknowledged)
      .length,
    low: alerts.filter((a) => a.severity === 'low' && !a.acknowledged).length,
    unacknowledged: alerts.filter((a) => !a.acknowledged).length,
    total: alerts.length,
  }

  const formatMttr = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return 'N/A'
    if (minutes < 60) return `${Math.round(minutes)}m`
    if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`
    return `${(minutes / 1440).toFixed(1)}d`
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          {/* Row 1: Severity badges + counts */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="text-sm font-medium text-muted-foreground">
                Active Alerts
              </div>
              <div className="flex items-center space-x-2">
                <Badge
                  variant="destructive"
                  className="cursor-pointer hover:opacity-80"
                  onClick={() => onFilterBySeverity?.('critical')}
                >
                  🚨 Critical: {localStats.critical}
                </Badge>
                <Badge
                  variant="outline"
                  className="cursor-pointer border-orange-500 text-orange-700 hover:opacity-80 dark:text-orange-400"
                  onClick={() => onFilterBySeverity?.('high')}
                >
                  ⚠️ High: {localStats.high}
                </Badge>
                <Badge
                  variant="outline"
                  className="cursor-pointer border-yellow-500 text-yellow-700 hover:opacity-80 dark:text-yellow-400"
                  onClick={() => onFilterBySeverity?.('medium')}
                >
                  🟡 Medium: {localStats.medium}
                </Badge>
                <Badge
                  variant="outline"
                  className="cursor-pointer border-blue-500 text-blue-700 hover:opacity-80 dark:text-blue-400"
                  onClick={() => onFilterBySeverity?.('low')}
                >
                  ℹ️ Low: {localStats.low}
                </Badge>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <span className="font-medium">{localStats.unacknowledged}</span>
                <span className="ml-1 text-muted-foreground">Unacknowledged</span>
              </div>
              <div className="text-sm">
                <span className="font-medium">{localStats.total}</span>
                <span className="ml-1 text-muted-foreground">Total</span>
              </div>
            </div>
          </div>

          {/* Row 2: Extended stats from DB */}
          {stats && (
            <div className="flex flex-wrap items-center gap-4 border-t pt-3">
              <div
                className="flex items-center space-x-1 rounded-md bg-muted px-2.5 py-1"
                title={`Mean Time to Resolve (30d)${stats.fastest_resolution_minutes !== null ? `\nFastest: ${formatMttr(stats.fastest_resolution_minutes)}` : ''}`}
              >
                <span className="text-xs text-muted-foreground">⏱ MTTR:</span>
                <span className="text-xs font-semibold">
                  {formatMttr(stats.mttr_minutes)}
                </span>
              </div>

              <div className="flex items-center space-x-1 rounded-md bg-muted px-2.5 py-1">
                <span className="text-xs text-muted-foreground">24h:</span>
                <span className="text-xs font-semibold">{stats.alerts_last_24h}</span>
              </div>

              <div className="flex items-center space-x-1 rounded-md bg-muted px-2.5 py-1">
                <span className="text-xs text-muted-foreground">7d:</span>
                <span className="text-xs font-semibold">{stats.alerts_last_7d}</span>
              </div>

              {stats.snoozed_alerts > 0 && (
                <div className="flex items-center space-x-1 rounded-md bg-yellow-100 px-2.5 py-1 dark:bg-yellow-950">
                  <span className="text-xs text-yellow-700 dark:text-yellow-300">
                    😴 Snoozed: {stats.snoozed_alerts}
                  </span>
                </div>
              )}

              <div className="flex items-center space-x-1 rounded-md bg-muted px-2.5 py-1">
                <span className="text-xs text-muted-foreground">Resolved:</span>
                <span className="text-xs font-semibold">{stats.resolved_alerts}</span>
              </div>

              {topDevices.length > 0 && (
                <div
                  className="flex items-center space-x-1 rounded-md bg-orange-50 px-2.5 py-1 dark:bg-orange-950"
                  title={`Top Alerting Devices (30d)\n${topDevices.slice(0, 5).map((d, i) => `${i + 1}. ${d.device_name} — ${d.alert_count} alerts${d.critical_count > 0 ? ` (${d.critical_count} critical)` : ''}`).join('\n')}`}
                >
                  <span className="text-xs text-orange-700 dark:text-orange-300">
                    🔥 Top: {topDevices[0].device_name}
                    <span className="ml-1 font-semibold">({topDevices[0].alert_count})</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
