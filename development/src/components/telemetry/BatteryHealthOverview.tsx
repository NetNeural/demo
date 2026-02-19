'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Battery, BatteryLow, BatteryWarning, Loader2 } from 'lucide-react'

interface BatteryHealth {
  critical: number // < 20%
  warning: number // 20-50%
  healthy: number // > 50%
  total: number
}

interface BatteryHealthOverviewProps {
  organizationId: string
}

export function BatteryHealthOverview({ organizationId }: BatteryHealthOverviewProps) {
  const [health, setHealth] = useState<BatteryHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchBatteryHealth = useCallback(async () => {
    try {
      setLoading(true)

      // Get latest battery telemetry for each device
      const { data: devices, error: devicesError } = await supabase
        .from('devices')
        .select('id, name')
        .eq('organization_id', organizationId)
        .eq('status', 'online')

      if (devicesError) {
        console.error('[Battery Health] Devices fetch error:', devicesError)
        return
      }

      if (!devices || devices.length === 0) {
        setHealth({ critical: 0, warning: 0, healthy: 0, total: 0 })
        return
      }

      // Get latest telemetry with battery data for each device
      const batteryLevels: number[] = []

      for (const device of devices) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: telemetry } = await (supabase as any)
          .from('device_telemetry_history')
          .select('telemetry')
          .eq('device_id', device.id)
          .not('telemetry->battery', 'is', null)
          .order('device_timestamp', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (telemetry?.telemetry?.battery) {
          const batteryLevel = parseFloat(String(telemetry.telemetry.battery))
          if (!isNaN(batteryLevel)) {
            batteryLevels.push(batteryLevel)
          }
        }
      }

      // Categorize battery levels
      const critical = batteryLevels.filter((level) => level < 20).length
      const warning = batteryLevels.filter((level) => level >= 20 && level < 50).length
      const healthy = batteryLevels.filter((level) => level >= 50).length

      setHealth({
        critical,
        warning,
        healthy,
        total: batteryLevels.length,
      })
    } catch (err) {
      console.error('[Battery Health] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [organizationId, supabase])

  useEffect(() => {
    fetchBatteryHealth()
  }, [fetchBatteryHealth])

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (!health || health.total === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Battery Health Overview</h3>
        <p className="text-sm text-gray-500">No battery data available</p>
      </div>
    )
  }

  const criticalPercent = (health.critical / health.total) * 100
  const warningPercent = (health.warning / health.total) * 100
  const healthyPercent = (health.healthy / health.total) * 100

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Battery Health Overview</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Critical */}
        <div className="flex items-start space-x-3 p-4 rounded-lg bg-red-50 border border-red-200">
          <BatteryLow className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-900">Critical</p>
            <p className="text-2xl font-bold text-red-600">{health.critical}</p>
            <p className="text-xs text-red-700">Below 20%</p>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start space-x-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <BatteryWarning className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">Warning</p>
            <p className="text-2xl font-bold text-amber-600">{health.warning}</p>
            <p className="text-xs text-amber-700">20-50%</p>
          </div>
        </div>

        {/* Healthy */}
        <div className="flex items-start space-x-3 p-4 rounded-lg bg-green-50 border border-green-200">
          <Battery className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-900">Healthy</p>
            <p className="text-2xl font-bold text-green-600">{health.healthy}</p>
            <p className="text-xs text-green-700">Above 50%</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Total devices with battery data</span>
          <span className="font-semibold text-gray-900">{health.total}</span>
        </div>
        <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex">
          {health.critical > 0 && (
            <div
              className="bg-red-500 h-full transition-all"
              style={{ width: `${criticalPercent}%` }}
              title={`Critical: ${health.critical} devices (${criticalPercent.toFixed(1)}%)`}
            />
          )}
          {health.warning > 0 && (
            <div
              className="bg-amber-500 h-full transition-all"
              style={{ width: `${warningPercent}%` }}
              title={`Warning: ${health.warning} devices (${warningPercent.toFixed(1)}%)`}
            />
          )}
          {health.healthy > 0 && (
            <div
              className="bg-green-500 h-full transition-all"
              style={{ width: `${healthyPercent}%` }}
              title={`Healthy: ${health.healthy} devices (${healthyPercent.toFixed(1)}%)`}
            />
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{criticalPercent.toFixed(1)}% Critical</span>
          <span>{warningPercent.toFixed(1)}% Warning</span>
          <span>{healthyPercent.toFixed(1)}% Healthy</span>
        </div>
      </div>
    </div>
  )
}
