import { useState, useEffect, useCallback } from 'react'
import { edgeFunctions } from '@/lib/edge-functions'
import type {
  UnifiedDeviceStatus,
  DeviceConnectionStatus,
} from '@/types/unified-device-status'

// Issue #280: Typed device status API response
interface DeviceStatusApiData {
  deviceId: string
  externalDeviceId?: string
  organizationId: string
  integration?: { id: string; name: string }
  status?: string
  lastSeen?: string | null
  lastSeenOnline?: string | null
  lastSeenOffline?: string | null
  name: string
  deviceType?: string
  batteryLevel?: number | null
  signalStrength?: number | null
  latestTelemetry?: Record<string, unknown> | null
  location?: { latitude: number; longitude: number } | null
  metadata?: Record<string, unknown> | null
  firmware?: { version: string; updateAvailable?: boolean } | null
  createdAt?: string
  updatedAt?: string
}

interface UseDeviceStatusOptions {
  deviceId: string
  refreshInterval?: number // milliseconds, 0 = no auto-refresh
  enabled?: boolean // default true
}

interface UseDeviceStatusReturn {
  status: UnifiedDeviceStatus | null
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

/**
 * React hook for fetching and monitoring device status from the database
 *
 * Queries the devices table directly for current status information.
 * Device status is kept up-to-date by integration providers via sync operations.
 *
 * For real-time provider queries, use the integration provider classes directly.
 *
 * @example
 * ```tsx
 * const { status, isLoading, error, refresh } = useDeviceStatus({
 *   deviceId: 'abc123',
 *   refreshInterval: 30000, // 30 seconds
 * });
 * ```
 */
export function useDeviceStatus({
  deviceId,
  refreshInterval = 0,
  enabled = true,
}: UseDeviceStatusOptions): UseDeviceStatusReturn {
  const [status, setStatus] = useState<UnifiedDeviceStatus | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!enabled || !deviceId) {
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Fetch device status from edge function
      const response = await edgeFunctions.devices.getStatus(deviceId)

      if (!response.success) {
        throw new Error(
          response.error?.message || 'Failed to fetch device status'
        )
      }

      const deviceData = response.data?.status as
        | DeviceStatusApiData
        | undefined

      if (!deviceData) {
        throw new Error('Device not found')
      }

      // Transform to UnifiedDeviceStatus format
      const deviceStatus: UnifiedDeviceStatus = {
        // Core identification
        deviceId: deviceData.deviceId,
        externalDeviceId: deviceData.externalDeviceId || '',
        organizationId: deviceData.organizationId,
        integrationId: deviceData.integration?.id || '',
        providerType: deviceData.integration?.name || 'unknown',

        // Status
        status: (deviceData.status as DeviceConnectionStatus) || 'unknown',
        lastSeen: deviceData.lastSeen ?? null,
        lastSeenOnline: deviceData.lastSeen ?? null,
        lastSeenOffline: null,

        // Device info
        name: deviceData.name,
        deviceType: deviceData.deviceType || 'unknown',

        // Health metrics
        health:
          deviceData.batteryLevel || deviceData.signalStrength
            ? {
                battery: deviceData.batteryLevel || undefined,
                signalStrength: deviceData.signalStrength || undefined,
              }
            : undefined,

        // Timestamps
        createdAt: deviceData.createdAt || new Date().toISOString(),
        updatedAt: deviceData.updatedAt || new Date().toISOString(),
      }

      setStatus(deviceStatus)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setStatus(null)
    } finally {
      setIsLoading(false)
    }
  }, [deviceId, enabled])

  // Initial fetch
  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  // Auto-refresh
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) {
      return
    }

    const interval = setInterval(() => {
      void fetchStatus()
    }, refreshInterval)

    return () => {
      clearInterval(interval)
    }
  }, [fetchStatus, refreshInterval, enabled])

  return {
    status,
    isLoading,
    error,
    refresh: fetchStatus,
  }
}
