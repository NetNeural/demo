import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Zap, TrendingUp, Battery } from 'lucide-react'
import type { SystemHealth } from '../types/analytics.types'

interface SystemHealthCardsProps {
  health: SystemHealth
}

export function SystemHealthCards({ health }: SystemHealthCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{health.overall_health}%</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {health.overall_health > 80
              ? 'System healthy'
              : health.overall_health > 50
                ? 'Some issues detected'
                : 'Needs attention'}
          </p>
        </CardContent>
      </Card>

      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Connectivity</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{health.connectivity_rate}%</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Active in last 5 minutes
          </p>
        </CardContent>
      </Card>

      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Performance Score
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{health.performance_score}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Out of 100 points
          </p>
        </CardContent>
      </Card>

      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Battery Health</CardTitle>
          <Battery className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {health.avg_battery_health.toFixed(0)}%
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Fleet average</p>
        </CardContent>
      </Card>
    </div>
  )
}
