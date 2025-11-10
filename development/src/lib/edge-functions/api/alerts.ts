/**
 * Alerts API Module
 */

import type { EdgeFunctionResponse, EdgeFunctionOptions } from '../types'

export interface AlertsAPI {
  list: (organizationId: string, options?: {
    limit?: number
    severity?: 'info' | 'warning' | 'error' | 'critical'
    resolved?: boolean
  }) => Promise<EdgeFunctionResponse<{ alerts: unknown[]; count: number }>>
  acknowledge: (alertId: string) => Promise<EdgeFunctionResponse<unknown>>
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
     * Acknowledge an alert
     */
    acknowledge: (alertId) =>
      call(`alerts/${alertId}/acknowledge`, {
        method: 'PATCH',
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
