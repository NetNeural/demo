/**
 * Activity Logger for Frontend Integration Providers
 * 
 * Mirrors the edge function activity-logger.ts but works in frontend/client context
 * Logs all integration activity to integration_activity_log table
 */

import { createClient } from '@/lib/supabase/client'

export type ActivityDirection = 'outgoing' | 'incoming'

export type ActivityType =
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

export interface ActivityLogStart {
  organizationId: string
  integrationId: string
  direction: ActivityDirection
  activityType: ActivityType
  method?: string
  endpoint?: string
  requestBody?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface ActivityLogComplete {
  status: 'success' | 'failed' | 'timeout' | 'error'
  responseStatus?: number
  responseBody?: Record<string, unknown>
  responseTimeMs?: number
  errorMessage?: string
  errorCode?: string
}

/**
 * Frontend Activity Logger
 * Logs integration provider activity from frontend components
 */
export class FrontendActivityLogger {
  private supabase = createClient()

  /**
   * Log the start of an activity
   * Returns log ID for completion
   */
  async start(params: ActivityLogStart): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('integration_activity_log')
        .insert({
          organization_id: params.organizationId,
          integration_id: params.integrationId,
          direction: params.direction,
          activity_type: params.activityType,
          method: params.method,
          endpoint: params.endpoint,
          request_body: params.requestBody,
          status: 'started',
          metadata: params.metadata || {},
        })
        .select('id')
        .single()

      if (error) {
        console.error('[ActivityLogger] Failed to log activity start:', error)
        return null
      }

      return data.id
    } catch (error) {
      console.error('[ActivityLogger] Exception logging activity start:', error)
      return null
    }
  }

  /**
   * Complete an activity log
   */
  async complete(logId: string | null, update: ActivityLogComplete): Promise<void> {
    if (!logId) return

    try {
      const { error } = await this.supabase
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
        console.error('[ActivityLogger] Failed to complete activity log:', error)
      }
    } catch (error) {
      console.error('[ActivityLogger] Exception completing activity log:', error)
    }
  }

  /**
   * Wrap an async operation with automatic activity logging
   */
  async withLog<T>(
    params: ActivityLogStart,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()
    const logId = await this.start(params)

    try {
      const result = await fn()
      const responseTimeMs = Date.now() - startTime

      await this.complete(logId, {
        status: 'success',
        responseTimeMs,
        responseBody: typeof result === 'object' ? result as Record<string, unknown> : { value: result },
      })

      return result
    } catch (error) {
      const responseTimeMs = Date.now() - startTime

      await this.complete(logId, {
        status: 'failed',
        responseTimeMs,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: (error as any).code,
      })

      throw error
    }
  }

  /**
   * Get recent activity for an integration
   */
  async getRecentActivity(
    integrationId: string,
    limit: number = 20
  ): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('integration_activity_log')
      .select('*')
      .eq('integration_id', integrationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[ActivityLogger] Failed to fetch recent activity:', error)
      return []
    }

    return data || []
  }

  /**
   * Get failed activities for an integration
   */
  async getFailedActivity(
    integrationId: string,
    limit: number = 10
  ): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('integration_activity_log')
      .select('*')
      .eq('integration_id', integrationId)
      .in('status', ['failed', 'error', 'timeout'])
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[ActivityLogger] Failed to fetch failed activity:', error)
      return []
    }

    return data || []
  }

  /**
   * Get activity statistics for an integration
   */
  async getActivityStats(
    integrationId: string,
    since?: Date
  ): Promise<{
    total: number
    success: number
    failed: number
    avgResponseTime: number | null
  }> {
    let query = this.supabase
      .from('integration_activity_log')
      .select('status, response_time_ms')
      .eq('integration_id', integrationId)

    if (since) {
      query = query.gte('created_at', since.toISOString())
    }

    const { data, error } = await query

    if (error || !data) {
      return { total: 0, success: 0, failed: 0, avgResponseTime: null }
    }

    const total = data.length
    const success = data.filter(d => d.status === 'success').length
    const failed = data.filter(d => ['failed', 'error', 'timeout'].includes(d.status)).length
    const responseTimes = data
      .filter(d => d.response_time_ms !== null)
      .map(d => d.response_time_ms)
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : null

    return { total, success, failed, avgResponseTime }
  }
}
