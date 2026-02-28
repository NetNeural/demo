import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity } from 'lucide-react'
import type { DevicePerformance } from '../types/analytics.types'

interface DevicePerformanceTableProps {
  devices: DevicePerformance[]
}

export function DevicePerformanceTable({
  devices,
}: DevicePerformanceTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Device Performance</CardTitle>
        <CardDescription>
          Detailed metrics for each device in your fleet
        </CardDescription>
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              No device data available for the selected time range
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {devices
              .sort((a, b) => b.uptime_percentage - a.uptime_percentage)
              .map((device) => (
                <div
                  key={device.device_id}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{device.device_name}</h3>
                      {!device.last_error ? (
                        <Badge
                          variant="outline"
                          className="border-green-600 text-green-600"
                        >
                          Healthy
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-red-600 text-red-600"
                        >
                          Error
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {device.data_points_count.toLocaleString()} data points
                      </span>
                      {device.avg_battery !== undefined && (
                        <span>Battery: {device.avg_battery.toFixed(0)}%</span>
                      )}
                      {device.avg_rssi !== undefined && (
                        <span>Signal: {device.avg_rssi.toFixed(0)} dBm</span>
                      )}
                    </div>
                    {device.last_error && (
                      <p className="mt-1 text-xs text-red-600">
                        {device.last_error}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-lg font-bold">
                      {device.uptime_percentage.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">Uptime</p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
