'use client'

import { HistoricalDataViewer } from '@/components/sensors/HistoricalDataViewer'
import { StatisticalSummaryCard } from '@/components/sensors/StatisticalSummaryCard'
import { TestDeviceControls } from '@/components/devices/TestDeviceControls'
import type { Device, TelemetryReading } from '@/types/sensor-details'

interface DeviceTelemetryTabProps {
  device: Device
  telemetryReadings: TelemetryReading[]
  isGateway: boolean
  isTestDevice: boolean
  temperatureUnit: 'celsius' | 'fahrenheit'
  historyRefreshKey: number
  onDataSent: () => void
}

export function DeviceTelemetryTab({
  device,
  telemetryReadings,
  isGateway,
  isTestDevice: isTest,
  temperatureUnit,
  historyRefreshKey,
  onDataSent,
}: DeviceTelemetryTabProps) {
  if (isGateway) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-lg font-medium">Gateway devices don&apos;t produce sensor telemetry</p>
        <p className="mt-1 text-sm">Gateways relay data from child sensors. View child sensors for telemetry data.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Historical Data Viewer */}
      <HistoricalDataViewer device={device} refreshKey={historyRefreshKey} />

      {/* Test Device Controls */}
      {isTest && (
        <TestDeviceControls
          deviceId={device.id}
          deviceTypeId={device.device_type_id || null}
          currentStatus={device.status}
          onDataSent={onDataSent}
        />
      )}

      {/* Statistical Summary */}
      <StatisticalSummaryCard
        device={device}
        telemetryReadings={telemetryReadings}
        temperatureUnit={temperatureUnit}
      />
    </div>
  )
}
