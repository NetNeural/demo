/**
 * User Actions API Module
 * Track user interactions for analytics and audit trails
 */

import type { EdgeFunctionResponse, EdgeFunctionOptions } from '../types'

export interface UserAction {
  id: string
  user_id: string
  organization_id: string
  action_type: string
  action_category: string
  description?: string
  device_id?: string
  integration_id?: string
  alert_id?: string
  alert_rule_id?: string
  metadata?: Record<string, unknown>
  success: boolean
  error_message?: string
  created_at: string
}

export interface AlertAcknowledgement {
  id: string
  alert_id: string
  user_id: string
  organization_id: string
  acknowledged_at: string
  acknowledgement_type: 'acknowledged' | 'dismissed' | 'resolved' | 'false_positive'
  notes?: string
}

export interface UserActionsAPI {
  acknowledgeAlert: (alertId: string, type?: 'acknowledged' | 'dismissed' | 'resolved' | 'false_positive', notes?: string) => Promise<EdgeFunctionResponse<{ acknowledgement_id: string }>>
  recordAction: (action: {
    action_type: string
    action_category: 'device_management' | 'integration_management' | 'alert_management' | 'sync_operation' | 'configuration' | 'authentication' | 'analytics_view' | 'other'
    description?: string
    device_id?: string
    integration_id?: string
    alert_id?: string
    alert_rule_id?: string
    metadata?: Record<string, unknown>
    success?: boolean
    error_message?: string
  }) => Promise<EdgeFunctionResponse<{ action_id: string }>>
  getAlertAcknowledgements: (alertId?: string, organizationId?: string) => Promise<EdgeFunctionResponse<{ acknowledgements: AlertAcknowledgement[] }>>
  getUserActions: (options?: {
    device_id?: string
    user_id?: string
    action_category?: string
    limit?: number
  }) => Promise<EdgeFunctionResponse<{ actions: UserAction[] }>>
}

export function createUserActionsAPI(call: <T>(functionName: string, options?: EdgeFunctionOptions) => Promise<EdgeFunctionResponse<T>>): UserActionsAPI {
  return {
    /**
     * Acknowledge an alert with optional notes
     */
    acknowledgeAlert: (alertId, type = 'acknowledged', notes) =>
      call<{ acknowledgement_id: string }>('user-actions', {
        method: 'POST',
        params: { action: 'acknowledge_alert' },
        body: {
          alert_id: alertId,
          acknowledgement_type: type,
          ...(notes && { notes }),
        },
      }),
    
    /**
     * Record a user action
     */
    recordAction: (action) =>
      call<{ action_id: string }>('user-actions', {
        method: 'POST',
        params: { action: 'record_action' },
        body: action,
      }),
    
    /**
     * Get alert acknowledgements
     */
    getAlertAcknowledgements: (alertId, organizationId) =>
      call<{ acknowledgements: AlertAcknowledgement[] }>('user-actions', {
        params: {
          action: 'get_alert_acknowledgements',
          ...(alertId && { alert_id: alertId }),
          ...(organizationId && { organization_id: organizationId }),
        },
      }),
    
    /**
     * Get user actions history
     */
    getUserActions: (options = {}) =>
      call<{ actions: UserAction[] }>('user-actions', {
        params: {
          action: 'get_user_actions',
          ...options,
        },
      }),
  }
}
