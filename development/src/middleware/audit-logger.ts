/**
 * Audit Logger Middleware
 * Automatically logs user actions to user_audit_log table
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface AuditLogEntry {
  userId?: string
  userEmail?: string
  organizationId?: string
  actionCategory: 
    | 'authentication'
    | 'device_management'
    | 'integration_management'
    | 'alert_management'
    | 'user_management'
    | 'organization_management'
    | 'configuration'
    | 'data_import_export'
    | 'webhook'
    | 'mqtt'
    | 'notification'
    | 'other'
  actionType: string
  resourceType?: string
  resourceId?: string
  resourceName?: string
  method?: string
  endpoint?: string
  changes?: Record<string, unknown>
  metadata?: Record<string, unknown>
  status?: 'success' | 'failed' | 'error' | 'pending'
  errorMessage?: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
}

/**
 * Log a user action to the audit log
 */
export async function logUserAction(entry: AuditLogEntry): Promise<string | null> {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get current user if not provided
    if (!entry.userId) {
      const { data: { user } } = await supabase.auth.getUser()
      entry.userId = user?.id
      entry.userEmail = entry.userEmail || user?.email
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('log_user_action', {
      p_user_id: entry.userId || null,
      p_user_email: entry.userEmail || null,
      p_organization_id: entry.organizationId || null,
      p_action_category: entry.actionCategory,
      p_action_type: entry.actionType,
      p_resource_type: entry.resourceType || null,
      p_resource_id: entry.resourceId || null,
      p_resource_name: entry.resourceName || null,
      p_method: entry.method || null,
      p_endpoint: entry.endpoint || null,
      p_changes: entry.changes || {},
      p_metadata: entry.metadata || {},
      p_status: entry.status || 'success',
      p_error_message: entry.errorMessage || null,
      p_ip_address: entry.ipAddress || null,
      p_user_agent: entry.userAgent || null,
      p_session_id: entry.sessionId || null,
    })
    
    if (error) {
      console.error('[AuditLog] Failed to log action:', error)
      return null
    }
    
    return data
  } catch (error) {
    console.error('[AuditLog] Exception logging action:', error)
    return null
  }
}

/**
 * Create audit log entry from Next.js request
 */
export async function logFromRequest(
  request: Request,
  entry: Omit<AuditLogEntry, 'ipAddress' | 'userAgent'>
): Promise<string | null> {
  const ipAddress = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  return logUserAction({
    ...entry,
    ipAddress,
    userAgent,
  })
}

/**
 * Convenience functions for common actions
 */
export const auditLog = {
  // Authentication
  login: (userId: string, email: string, metadata?: Record<string, unknown>) =>
    logUserAction({
      userId,
      userEmail: email,
      actionCategory: 'authentication',
      actionType: 'login',
      method: 'POST',
      endpoint: '/auth/login',
      metadata,
      status: 'success',
    }),

  loginFailed: (email: string, errorMessage: string, metadata?: Record<string, unknown>) =>
    logUserAction({
      userEmail: email,
      actionCategory: 'authentication',
      actionType: 'login_failed',
      method: 'POST',
      endpoint: '/auth/login',
      metadata,
      status: 'failed',
      errorMessage,
    }),

  logout: (userId: string, email: string) =>
    logUserAction({
      userId,
      userEmail: email,
      actionCategory: 'authentication',
      actionType: 'logout',
      method: 'POST',
      endpoint: '/auth/logout',
      status: 'success',
    }),

  // Device management
  deviceCreate: (userId: string, organizationId: string, deviceId: string, deviceName: string) =>
    logUserAction({
      userId,
      organizationId,
      actionCategory: 'device_management',
      actionType: 'device_create',
      resourceType: 'device',
      resourceId: deviceId,
      resourceName: deviceName,
      method: 'POST',
      endpoint: '/api/devices',
      status: 'success',
    }),

  deviceUpdate: (userId: string, organizationId: string, deviceId: string, deviceName: string, changes: Record<string, unknown>) =>
    logUserAction({
      userId,
      organizationId,
      actionCategory: 'device_management',
      actionType: 'device_update',
      resourceType: 'device',
      resourceId: deviceId,
      resourceName: deviceName,
      method: 'PUT',
      endpoint: `/api/devices/${deviceId}`,
      changes,
      status: 'success',
    }),

  deviceDelete: (userId: string, organizationId: string, deviceId: string, deviceName: string) =>
    logUserAction({
      userId,
      organizationId,
      actionCategory: 'device_management',
      actionType: 'device_delete',
      resourceType: 'device',
      resourceId: deviceId,
      resourceName: deviceName,
      method: 'DELETE',
      endpoint: `/api/devices/${deviceId}`,
      status: 'success',
    }),

  // Integration management
  integrationCreate: (userId: string, organizationId: string, integrationId: string, integrationName: string, integrationType: string) =>
    logUserAction({
      userId,
      organizationId,
      actionCategory: 'integration_management',
      actionType: 'integration_create',
      resourceType: 'integration',
      resourceId: integrationId,
      resourceName: integrationName,
      method: 'POST',
      endpoint: '/api/integrations',
      metadata: { integration_type: integrationType },
      status: 'success',
    }),

  integrationUpdate: (userId: string, organizationId: string, integrationId: string, integrationName: string, changes: Record<string, unknown>) =>
    logUserAction({
      userId,
      organizationId,
      actionCategory: 'integration_management',
      actionType: 'integration_update',
      resourceType: 'integration',
      resourceId: integrationId,
      resourceName: integrationName,
      method: 'PUT',
      endpoint: `/api/integrations/${integrationId}`,
      changes,
      status: 'success',
    }),

  integrationDelete: (userId: string, organizationId: string, integrationId: string, integrationName: string) =>
    logUserAction({
      userId,
      organizationId,
      actionCategory: 'integration_management',
      actionType: 'integration_delete',
      resourceType: 'integration',
      resourceId: integrationId,
      resourceName: integrationName,
      method: 'DELETE',
      endpoint: `/api/integrations/${integrationId}`,
      status: 'success',
    }),

  // Alert management
  alertAcknowledge: (userId: string, organizationId: string, alertId: string, alertType: string) =>
    logUserAction({
      userId,
      organizationId,
      actionCategory: 'alert_management',
      actionType: 'alert_acknowledge',
      resourceType: 'alert',
      resourceId: alertId,
      resourceName: alertType,
      method: 'POST',
      endpoint: `/api/alerts/${alertId}/acknowledge`,
      status: 'success',
    }),

  // Configuration
  settingsUpdate: (userId: string, organizationId: string, changes: Record<string, unknown>) =>
    logUserAction({
      userId,
      organizationId,
      actionCategory: 'configuration',
      actionType: 'settings_update',
      resourceType: 'organization',
      resourceId: organizationId,
      method: 'PUT',
      endpoint: '/api/settings',
      changes,
      status: 'success',
    }),
}
