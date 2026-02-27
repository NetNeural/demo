'use client'

import { useState } from 'react'
import { AlertsThresholdsCard } from '@/components/sensors/AlertsThresholdsCard'
import { RecentActivityCard } from '@/components/sensors/RecentActivityCard'
import type { Device } from '@/types/sensor-details'

interface DeviceAlertsTabProps {
  device: Device
  isGateway: boolean
}

export function DeviceAlertsTab({ device, isGateway }: DeviceAlertsTabProps) {
  const [temperatureUnit, setTemperatureUnit] = useState<'celsius' | 'fahrenheit'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('temperatureUnit')
      if (stored === 'C') return 'celsius'
    }
    return 'fahrenheit'
  })

  return (
    <div className="space-y-6">
      {!isGateway && (
        <AlertsThresholdsCard
          device={device}
          temperatureUnit={temperatureUnit}
          onTemperatureUnitChange={setTemperatureUnit}
        />
      )}
      <RecentActivityCard device={device} />
    </div>
  )
}
