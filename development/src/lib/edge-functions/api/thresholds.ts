// API: Thresholds Management
// Handles sensor threshold configuration and alerting

import type { EdgeFunctionResponse } from '../types'
import type { SensorThreshold } from '@/types/sensor-details'

export interface ThresholdsAPI {
  list: (deviceId: string) => Promise<EdgeFunctionResponse<{ thresholds: SensorThreshold[] }>>
  create: (payload: ThresholdPayload) => Promise<EdgeFunctionResponse<{ threshold: SensorThreshold }>>
  update: (thresholdId: string, payload: Partial<ThresholdPayload>) => Promise<EdgeFunctionResponse<{ threshold: SensorThreshold }>>
  delete: (thresholdId: string) => Promise<EdgeFunctionResponse<{ success: boolean }>>
}

export interface ThresholdPayload {
  device_id: string
  sensor_type: string
  min_value?: number | null
  max_value?: number | null
  critical_min?: number | null
  critical_max?: number | null
  alert_enabled?: boolean
  alert_severity?: 'low' | 'medium' | 'high' | 'critical'
  alert_message?: string | null
  notify_on_breach?: boolean
  notification_cooldown_minutes?: number
  notify_user_ids?: string[]
  notify_emails?: string[]
  notification_channels?: string[]
}

export const createThresholdsAPI = (
  call: <T>(functionName: string, options?: any) => Promise<EdgeFunctionResponse<T>>
): ThresholdsAPI => ({
  /**
   * List all thresholds for a device
   */
  list: (deviceId: string) =>
    call('thresholds', {
      method: 'GET',
      params: { device_id: deviceId },
    }),

  /**
   * Create a new threshold configuration
   */
  create: (payload: ThresholdPayload) =>
    call('thresholds', {
      method: 'POST',
      body: payload,
    }),

  /**
   * Update an existing threshold
   */
  update: (thresholdId: string, payload: Partial<ThresholdPayload>) =>
    call('thresholds', {
      method: 'PATCH',
      params: { threshold_id: thresholdId },
      body: payload,
    }),

  /**
   * Delete a threshold
   */
  delete: (thresholdId: string) =>
    call('thresholds', {
      method: 'DELETE',
      params: { threshold_id: thresholdId },
    }),
})
