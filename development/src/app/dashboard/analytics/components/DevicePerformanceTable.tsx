import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';
import type { DevicePerformance } from '../types/analytics.types';

interface DevicePerformanceTableProps {
  devices: DevicePerformance[];
}

export function DevicePerformanceTable({ devices }: DevicePerformanceTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Device Performance</CardTitle>
        <CardDescription>Detailed metrics for each device in your fleet</CardDescription>
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No device data available for the selected time range</p>
          </div>
        ) : (
          <div className="space-y-3">
            {devices
              .sort((a, b) => b.uptime_percentage - a.uptime_percentage)
              .map((device) => (
                <div
                  key={device.device_id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{device.device_name}</h3>
                      {!device.last_error ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Healthy
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-600">
                          Error
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{device.data_points_count.toLocaleString()} data points</span>
                      {device.avg_battery !== undefined && <span>Battery: {device.avg_battery.toFixed(0)}%</span>}
                      {device.avg_rssi !== undefined && <span>Signal: {device.avg_rssi.toFixed(0)} dBm</span>}
                    </div>
                    {device.last_error && <p className="text-xs text-red-600 mt-1">{device.last_error}</p>}
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-lg font-bold">{device.uptime_percentage.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">Uptime</p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
