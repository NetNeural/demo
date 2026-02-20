'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import type { Device } from '@/types/sensor-details'

interface TelemetryReading {
  telemetry: {
    value?: number
    [key: string]: unknown
  }
}

interface AlertsThresholdsCardProps {
  device: Device
  telemetryReadings: TelemetryReading[]
}

export function AlertsThresholdsCard({
  device,
  telemetryReadings,
}: AlertsThresholdsCardProps) {
  // Placeholder thresholds - will be configurable
  const activeAlerts = 0
  const totalAlerts = 3

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          ⚠️ Alerts & Thresholds
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">Active Alerts</span>
          <Badge variant={activeAlerts > 0 ? 'destructive' : 'secondary'}>
            {activeAlerts}/{totalAlerts}
          </Badge>
        </div>

        <div className="space-y-3 border-t pt-3">
          <p className="text-sm font-medium">Threshold Settings</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">High Threshold:</span>
              <span className="font-medium">85°C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Low Threshold:</span>
              <span className="font-medium">10°C</span>
            </div>
          </div>
        </div>

        <p className="border-t pt-3 text-xs text-muted-foreground">
          Configure alert thresholds in device settings
        </p>
      </CardContent>
    </Card>
  )
}
