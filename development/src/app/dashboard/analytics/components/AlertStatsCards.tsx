import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Clock } from 'lucide-react';
import type { AlertStats } from '../types/analytics.types';

interface AlertStatsCardsProps {
  stats: AlertStats;
}

function formatTime(minutes: number): string {
  return minutes < 60 ? `${Math.round(minutes)}m` : `${(minutes / 60).toFixed(1)}h`;
}

export function AlertStatsCards({ stats }: AlertStatsCardsProps) {
  const resolutionRate =
    stats.total_alerts > 0 ? Math.round((stats.resolved_alerts / stats.total_alerts) * 100) : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Alert Overview */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Alert Overview</CardTitle>
          <CardDescription>Alert counts by severity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center pb-4 border-b">
            <div className="text-4xl font-bold">{stats.total_alerts}</div>
            <p className="text-sm text-muted-foreground mt-1">Total Alerts</p>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Critical</span>
              <span className="text-sm font-medium">{stats.critical_alerts}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">High</span>
              <span className="text-sm font-medium">{stats.high_alerts}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Medium</span>
              <span className="text-sm font-medium">{stats.medium_alerts}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Low</span>
              <span className="text-sm font-medium">{stats.low_alerts}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t">
              <span className="text-sm">Resolved</span>
              <span className="text-sm font-medium text-green-600">{stats.resolved_alerts}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Pending</span>
              <span className="text-sm font-medium text-orange-600">{stats.pending_alerts}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Response Metrics */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Response Metrics</CardTitle>
          <CardDescription>Alert handling performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center pb-4 border-b">
            <div className="text-4xl font-bold">{resolutionRate}%</div>
            <p className="text-sm text-muted-foreground mt-1">Resolution Rate</p>
          </div>

          <div className="space-y-3">
            {stats.avg_response_time_minutes !== undefined && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Avg Response Time</span>
                </div>
                <span className="text-sm font-medium">{formatTime(stats.avg_response_time_minutes)}</span>
              </div>
            )}

            {stats.avg_resolution_time_minutes !== undefined && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Avg Resolution Time</span>
                </div>
                <span className="text-sm font-medium">{formatTime(stats.avg_resolution_time_minutes)}</span>
              </div>
            )}

            {stats.total_alerts === 0 && (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No alerts in the selected time range</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
