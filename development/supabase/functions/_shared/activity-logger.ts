// ===========================================================================
// Integration Activity Logger - Shared Utility
// ===========================================================================
// Helper functions to log all integration activity
// Tracks both outgoing calls and incoming webhooks
// ===========================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface ActivityLogParams {
  organizationId: string
  integrationId: string
  direction: 'outgoing' | 'incoming'
  activityType:
    | 'test_connection'
    | 'sync_import'
    | 'sync_export'
    | 'sync_bidirectional'
    | 'device_sync'
    | 'webhook_received'
    | 'notification_email'
    | 'notification_slack'
    | 'notification_webhook'
    | 'api_call'
    | 'device_create'
    | 'device_update'
    | 'device_delete'
    | 'other'
  method?: string
  endpoint?: string
  requestHeaders?: Record<string, string>
  requestBody?: Record<string, unknown>
  userId?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

export interface ActivityLogUpdate {
  status: 'started' | 'success' | 'failed' | 'timeout' | 'error'
  responseStatus?: number
  responseBody?: Record<string, unknown>
  responseTimeMs?: number
  errorMessage?: string
  errorCode?: string
}

/**
 * Log the start of an integration activity
 * Returns the log ID for later updates
 */
export async function logActivityStart(
  supabase: ReturnType<typeof createClient>,
  params: ActivityLogParams
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('integration_activity_log')
      .insert({
        organization_id: params.organizationId,
        integration_id: params.integrationId,
        direction: params.direction,
        activity_type: params.activityType,
        method: params.method,
        endpoint: params.endpoint,
        request_headers: params.requestHeaders || {},
        request_body: params.requestBody,
        status: 'started',
        user_id: params.userId,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
        metadata: params.metadata || {},
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to log activity start:', error)
      return null
    }

    return data.id
  } catch (error) {
    console.error('Exception logging activity start:', error)
    return null
  }
}

/**
 * Update an existing activity log with completion details
 */
export async function logActivityComplete(
  supabase: ReturnType<typeof createClient>,
  logId: string,
  update: ActivityLogUpdate
): Promise<void> {
  try {
    const { error } = await supabase
      .from('integration_activity_log')
      .update({
        status: update.status,
        response_status: update.responseStatus,
        response_body: update.responseBody,
        response_time_ms: update.responseTimeMs,
        error_message: update.errorMessage,
        error_code: update.errorCode,
        completed_at: new Date().toISOString(),
      })
      .eq('id', logId)

    if (error) {
      console.error('Failed to update activity log:', error)
    }
  } catch (error) {
    console.error('Exception updating activity log:', error)
  }
}

/**
 * Log a complete activity (start and finish in one call)
 * Useful for simple activities that complete synchronously
 */
export async function logActivity(
  supabase: ReturnType<typeof createClient>,
  params: ActivityLogParams & ActivityLogUpdate
): Promise<void> {
  try {
    console.log('[Activity Logger] Attempting to log activity:', {
      organizationId: params.organizationId,
      integrationId: params.integrationId,
      activityType: params.activityType,
      status: params.status,
    })
    
    const { data, error } = await supabase.from('integration_activity_log').insert({
      organization_id: params.organizationId,
      integration_id: params.integrationId,
      direction: params.direction,
      activity_type: params.activityType,
      method: params.method,
      endpoint: params.endpoint,
      request_headers: params.requestHeaders || {},
      request_body: params.requestBody,
      status: params.status,
      response_status: params.responseStatus,
      response_body: params.responseBody,
      response_time_ms: params.responseTimeMs,
      error_message: params.errorMessage,
      error_code: params.errorCode,
      user_id: params.userId,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      metadata: params.metadata || {},
      completed_at: new Date().toISOString(),
    })
    
    if (error) {
      console.error('[Activity Logger] Database insertion failed:', error)
      console.error('[Activity Logger] Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
    } else {
      console.log('[Activity Logger] Activity logged successfully:', data)
    }
  } catch (error) {
    console.error('[Activity Logger] Exception logging complete activity:', error)
  }
}

/**
 * Extract IP address from request
 */
export function getIpAddress(req: Request): string | undefined {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.headers.get('x-real-ip') ||
    undefined
  )
}

/**
 * Sanitize headers (remove sensitive data)
 */
export function sanitizeHeaders(headers: Headers): Record<string, string> {
  const sanitized: Record<string, string> = {}
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'api-key']

  headers.forEach((value, key) => {
    if (!sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = value
    } else {
      sanitized[key] = '[REDACTED]'
    }
  })

  return sanitized
}
