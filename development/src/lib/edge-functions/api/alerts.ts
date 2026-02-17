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
  list: (organizationId: string, options?: {
    limit?: number
    severity?: 'info' | 'warning' | 'error' | 'critical'
    resolved?: boolean
  }) => Promise<EdgeFunctionResponse<{ alerts: unknown[]; count: number }>>
  create: (data: CreateAlertData) => Promise<EdgeFunctionResponse<{ alert: unknown }>>
  acknowledge: (alertId: string) => Promise<EdgeFunctionResponse<unknown>>
  bulkAcknowledge: (alertIds: string[], organizationId: string, acknowledgementType?: string, notes?: string) => Promise<EdgeFunctionResponse<{ acknowledged_count: number }>>
  resolve: (alertId: string) => Promise<EdgeFunctionResponse<unknown>>
}

export function createAlertsAPI(call: <T>(functionName: string, options?: EdgeFunctionOptions) => Promise<EdgeFunctionResponse<T>>): AlertsAPI {
  return {
    /**
     * List alerts for an organization
     */
    list: (organizationId, options) =>
      call<{ alerts: unknown[]; count: number }>('alerts', {
        params: {
          organization_id: organizationId,
          ...(options?.limit && { limit: options.limit }),
          ...(options?.severity && { severity: options.severity }),
          ...(options?.resolved !== undefined && { resolved: options.resolved }),
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
    bulkAcknowledge: (alertIds, organizationId, acknowledgementType = 'acknowledged', notes) =>
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
  }
}
