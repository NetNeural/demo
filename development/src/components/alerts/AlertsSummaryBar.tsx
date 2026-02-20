'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
  const stats = {
    critical: alerts.filter((a) => a.severity === 'critical' && !a.acknowledged)
      .length,
    high: alerts.filter((a) => a.severity === 'high' && !a.acknowledged).length,
    medium: alerts.filter((a) => a.severity === 'medium' && !a.acknowledged)
      .length,
    low: alerts.filter((a) => a.severity === 'low' && !a.acknowledged).length,
    unacknowledged: alerts.filter((a) => !a.acknowledged).length,
    total: alerts.length,
  }

  return (
    <Card>
      <CardContent className="pt-6">
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
                🚨 Critical: {stats.critical}
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer border-orange-500 text-orange-700 hover:opacity-80 dark:text-orange-400"
                onClick={() => onFilterBySeverity?.('high')}
              >
                ⚠️ High: {stats.high}
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer border-yellow-500 text-yellow-700 hover:opacity-80 dark:text-yellow-400"
                onClick={() => onFilterBySeverity?.('medium')}
              >
                🟡 Medium: {stats.medium}
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer border-blue-500 text-blue-700 hover:opacity-80 dark:text-blue-400"
                onClick={() => onFilterBySeverity?.('low')}
              >
                ℹ️ Low: {stats.low}
              </Badge>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <span className="font-medium">{stats.unacknowledged}</span>
              <span className="ml-1 text-muted-foreground">Unacknowledged</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">{stats.total}</span>
              <span className="ml-1 text-muted-foreground">Total</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
