/**
 * Alerts API Module
 */

import type { EdgeFunctionResponse, EdgeFunctionOptions } from '../types'

export interface CreateAlertData {
  organization_id: string
  device_id: string
  alert_type: string
  category: string
  title: string
  message: string
  severity: string
  metadata?: Record<string, unknown>
}

export interface AlertsAPI {
  list: (
    organizationId: string,
    options?: {
      limit?: number
      offset?: number // Issue #269: Pagination offset
      severity?: 'info' | 'warning' | 'error' | 'critical'
      resolved?: boolean
    }
  ) => Promise<
    EdgeFunctionResponse<{
      alerts: unknown[]
      count: number
      totalCount: number
      offset: number
      limit: number
    }>
  >
  create: (
    data: CreateAlertData
  ) => Promise<EdgeFunctionResponse<{ alert: unknown }>>
  acknowledge: (alertId: string) => Promise<EdgeFunctionResponse<unknown>>
  bulkAcknowledge: (
    alertIds: string[],
    organizationId: string,
    acknowledgementType?: string,
    notes?: string
  ) => Promise<EdgeFunctionResponse<{ acknowledged_count: number }>>
  resolve: (alertId: string) => Promise<EdgeFunctionResponse<unknown>>
  snooze: (
    alertId: string,
    durationMinutes: number
  ) => Promise<EdgeFunctionResponse<{ message: string; snoozedUntil: string }>>
  unsnooze: (
    alertId: string
  ) => Promise<EdgeFunctionResponse<{ message: string }>>
  timeline: (
    alertId: string
  ) => Promise<EdgeFunctionResponse<{ events: AlertTimelineEvent[] }>>
  stats: (organizationId: string) => Promise<
    EdgeFunctionResponse<{
      stats: AlertStats
      topDevices: AlertDeviceRanking[]
    }>
  >
}

export interface AlertTimelineEvent {
  id: string
  alert_id: string
  event_type:
    | 'created'
    | 'notified'
    | 'viewed'
    | 'acknowledged'
    | 'resolved'
    | 'snoozed'
    | 'unsnoozed'
    | 'escalated'
    | 'comment'
  user_id: string | null
  userName: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface AlertStats {
  organization_id: string
  total_alerts: number
  active_alerts: number
  resolved_alerts: number
  active_critical: number
  active_high: number
  snoozed_alerts: number
  mttr_minutes: number | null
  fastest_resolution_minutes: number | null
  alerts_last_24h: number
  alerts_last_7d: number
}

export interface AlertDeviceRanking {
  device_id: string
  device_name: string
  alert_count: number
  active_count: number
  critical_count: number
  last_alert_at: string
}

export function createAlertsAPI(
  call: <T>(
    functionName: string,
    options?: EdgeFunctionOptions
  ) => Promise<EdgeFunctionResponse<T>>
): AlertsAPI {
  return {
    /**
     * List alerts for an organization
     */
    list: (organizationId, options) =>
      call<{
        alerts: unknown[]
        count: number
        totalCount: number
        offset: number
        limit: number
      }>('alerts', {
        params: {
          organization_id: organizationId,
          ...(options?.limit && { limit: options.limit }),
          ...(options?.offset !== undefined && { offset: options.offset }), // Issue #269
          ...(options?.severity && { severity: options.severity }),
          ...(options?.resolved !== undefined && {
            resolved: options.resolved,
          }),
        },
      }),

    /**
     * Create a new alert
     */
    create: (data) =>
      call<{ alert: unknown }>('alerts', {
        method: 'POST',
        body: data,
      }),

    /**
     * Acknowledge an alert
     */
    acknowledge: (alertId) =>
      call(`alerts/${alertId}/acknowledge`, {
        method: 'PATCH',
      }),

    /**
     * Bulk acknowledge multiple alerts (Issue #108)
     */
    bulkAcknowledge: (
      alertIds,
      organizationId,
      acknowledgementType = 'acknowledged',
      notes
    ) =>
      call<{ acknowledged_count: number }>('alerts/bulk-acknowledge', {
        method: 'POST',
        body: {
          alert_ids: alertIds,
          organization_id: organizationId,
          acknowledgement_type: acknowledgementType,
          notes,
        },
      }),

    /**
     * Resolve an alert
     */
    resolve: (alertId) =>
      call(`alerts/${alertId}/resolve`, {
        method: 'PATCH',
      }),

    /**
     * Snooze an alert for a specified duration
     */
    snooze: (alertId, durationMinutes) =>
      call<{ message: string; snoozedUntil: string }>('alerts/snooze', {
        method: 'POST',
        body: { alert_id: alertId, duration_minutes: durationMinutes },
      }),

    /**
     * Remove snooze from an alert
     */
    unsnooze: (alertId) =>
      call<{ message: string }>('alerts/unsnooze', {
        method: 'POST',
        body: { alert_id: alertId },
      }),

    /**
     * Get timeline events for an alert
     */
    timeline: (alertId) =>
      call<{ events: AlertTimelineEvent[] }>(`alerts/timeline/${alertId}`),

    /**
     * Get alert statistics for an organization
     */
    stats: (organizationId) =>
      call<{ stats: AlertStats; topDevices: AlertDeviceRanking[] }>(
        'alerts/stats',
        {
          params: { organization_id: organizationId },
        }
      ),
  }
}
