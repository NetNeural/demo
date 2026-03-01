/**
 * Integration Services
 * Provides easy-to-use functions for triggering integrations
 * Now uses the modular EdgeFunctionClient internally
 */

import { edgeFunctions } from '@/lib/edge-functions/client'

export interface NotificationOptions {
  organizationId: string
  integrationType: 'email' | 'slack' | 'webhook'
  integrationId?: string
  subject?: string
  message: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  data?: Record<string, unknown>
  recipients?: string[] // For email
}

export interface SyncOptions {
  organizationId: string
  integrationId: string
  operation: 'import' | 'export' | 'bidirectional'
  deviceIds?: string[]
}

export const integrationService = {
  /**
   * Send a notification via Email, Slack, or Webhook
   */
  async sendNotification(options: NotificationOptions) {
    const response = await edgeFunctions.integrations.sendNotification({
      organization_id: options.organizationId,
      integration_id: options.integrationId || '',
      message: options.message,
      severity: options.priority,
      metadata: {
        integration_type: options.integrationType,
        subject: options.subject,
        recipients: options.recipients,
        ...options.data,
      },
    })

    if (!response.success) {
      const errorMsg =
        typeof response.error === 'string'
          ? response.error
          : response.error?.message || 'Failed to send notification'
      throw new Error(errorMsg)
    }

    return response.data
  },

  /**
   * Send an email notification
   */
  async sendEmail(
    organizationId: string,
    recipients: string[],
    subject: string,
    message: string,
    integrationId?: string
  ) {
    return this.sendNotification({
      organizationId,
      integrationType: 'email',
      integrationId,
      recipients,
      subject,
      message,
    })
  },

  /**
   * Send a Slack message
   */
  async sendSlack(
    organizationId: string,
    message: string,
    data?: Record<string, unknown>,
    integrationId?: string
  ) {
    return this.sendNotification({
      organizationId,
      integrationType: 'slack',
      integrationId,
      message,
      data,
    })
  },

  /**
   * Trigger a custom webhook
   */
  async triggerWebhook(
    organizationId: string,
    message: string,
    data?: Record<string, unknown>,
    integrationId?: string
  ) {
    return this.sendNotification({
      organizationId,
      integrationType: 'webhook',
      integrationId,
      message,
      data,
    })
  },

  /**
   * Sync devices with AWS IoT Core
   * Now uses unified device-sync endpoint
   */
  async syncAwsIot(options: SyncOptions) {
    const response = await edgeFunctions.integrations.sync({
      organizationId: options.organizationId,
      integrationId: options.integrationId,
      operation: options.operation,
      deviceIds: options.deviceIds,
    })

    if (!response.success) {
      const errorMsg =
        typeof response.error === 'string'
          ? response.error
          : response.error?.message || 'Failed to sync with AWS IoT'
      throw new Error(errorMsg)
    }

    return response.data
  },

  /**
   * Sync devices with Golioth (uses unified device-sync function)
   */
  async syncGolioth(options: SyncOptions) {
    const response = await edgeFunctions.integrations.sync({
      organizationId: options.organizationId,
      integrationId: options.integrationId,
      operation: options.operation,
      deviceIds: options.deviceIds,
    })

    if (!response.success) {
      const errorMsg =
        typeof response.error === 'string'
          ? response.error
          : response.error?.message || 'Failed to sync with Golioth'
      throw new Error(errorMsg)
    }

    return response.data
  },

  /**
   * Sync devices with Azure IoT Hub
   * Now uses unified device-sync endpoint
   */
  async syncAzureIot(options: SyncOptions) {
    const response = await edgeFunctions.integrations.sync({
      organizationId: options.organizationId,
      integrationId: options.integrationId,
      operation: options.operation,
      deviceIds: options.deviceIds,
    })

    if (!response.success) {
      const errorMsg =
        typeof response.error === 'string'
          ? response.error
          : response.error?.message || 'Azure IoT sync failed'
      throw new Error(errorMsg)
    }

    return response.data
  },

  /**
   * Publish message to MQTT broker
   */
  async publishMqtt(
    organizationId: string,
    integrationId: string,
    messages: Array<{
      topic: string
      payload: string | object
      qos?: 0 | 1 | 2
      retain?: boolean
    }>
  ) {
    // For now, publish to the first topic with the first message
    const firstMessage = messages[0]
    if (!firstMessage) {
      throw new Error('No messages to publish')
    }

    const response = await edgeFunctions.integrations.publishMqtt({
      organization_id: organizationId,
      integration_id: integrationId,
      topic: firstMessage.topic,
      message:
        typeof firstMessage.payload === 'string'
          ? firstMessage.payload
          : JSON.stringify(firstMessage.payload),
    })

    if (!response.success) {
      const errorMsg =
        typeof response.error === 'string'
          ? response.error
          : response.error?.message || 'MQTT publish failed'
      throw new Error(errorMsg)
    }

    return response.data
  },

  /**
   * Subscribe to MQTT topics
   */
  async subscribeMqtt(
    organizationId: string,
    integrationId: string,
    topics: string[]
  ) {
    // Subscribe to the first topic
    const firstTopic = topics[0]
    if (!firstTopic) {
      throw new Error('No topics to subscribe to')
    }

    const response = await edgeFunctions.integrations.subscribeMqtt({
      organization_id: organizationId,
      integration_id: integrationId,
      topic: firstTopic,
    })

    if (!response.success) {
      const errorMsg =
        typeof response.error === 'string'
          ? response.error
          : response.error?.message || 'MQTT subscribe failed'
      throw new Error(errorMsg)
    }

    return response.data
  },

  /**
   * Test an integration configuration
   */
  async testIntegration(integrationId: string, integrationType: string) {
    const response = await edgeFunctions.integrations.test(integrationId)

    if (!response.success) {
      const errorMsg =
        typeof response.error === 'string'
          ? response.error
          : response.error?.message ||
            `Failed to test ${integrationType} connection`
      throw new Error(errorMsg)
    }

    return response.data
  },

  /**
   * Get notification history for an organization
   * Queries integration_activity_log filtered by notification types
   */
  async getNotificationLog(
    organizationId: string,
    options?: {
      type?: 'all' | 'email' | 'slack' | 'webhook' | 'sms'
      status?: 'all' | 'success' | 'failed' | 'started'
      limit?: number
      offset?: number
      dateFrom?: string
      dateTo?: string
    }
  ) {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    const notificationTypes = [
      'notification_email',
      'notification_slack',
      'notification_webhook',
    ]

    let query = supabase
      .from('integration_activity_log')
      .select(
        '*, device_integrations:integration_id(name, integration_type)',
        { count: 'exact' }
      )
      .eq('organization_id', organizationId)
      .in('activity_type', notificationTypes)
      .order('created_at', { ascending: false })

    // Apply type filter
    if (options?.type && options.type !== 'all') {
      query = query.eq('activity_type', `notification_${options.type}`)
    }

    // Apply status filter
    if (options?.status && options.status !== 'all') {
      if (options.status === 'failed') {
        query = query.in('status', ['failed', 'error', 'timeout'])
      } else {
        query = query.eq('status', options.status)
      }
    }

    // Apply date range
    if (options?.dateFrom) {
      query = query.gte('created_at', options.dateFrom)
    }
    if (options?.dateTo) {
      query = query.lte('created_at', options.dateTo)
    }

    // Apply pagination
    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[NotificationLog] Failed to query:', error)
      throw new Error(error.message || 'Failed to load notification log')
    }

    return { data: data || [], count: count ?? 0 }
  },

  /**
   * Retry a failed notification
   * Re-sends the notification using the original payload stored in metadata
   */
  async retryNotification(logEntryId: string, organizationId: string) {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    // Fetch the original log entry
    const { data: logEntry, error } = await supabase
      .from('integration_activity_log')
      .select('*')
      .eq('id', logEntryId)
      .eq('organization_id', organizationId)
      .single()

    if (error || !logEntry) {
      throw new Error('Failed to find notification log entry')
    }

    if (!['failed', 'error', 'timeout'].includes(logEntry.status)) {
      throw new Error('Only failed notifications can be retried')
    }

    // Extract original notification details from metadata
    const metadata = (logEntry.metadata || {}) as Record<string, unknown>
    const integrationType = (
      logEntry.activity_type as string
    ).replace('notification_', '') as 'email' | 'slack' | 'webhook'

    // Re-send using the integration service
    return integrationService.sendNotification({
      organizationId,
      integrationType,
      integrationId: logEntry.integration_id,
      message: (metadata.message as string) || (metadata.subject as string) || 'Retry notification',
      subject: metadata.subject as string | undefined,
      recipients: metadata.recipients as string[] | undefined,
      priority: metadata.severity as 'low' | 'medium' | 'high' | 'critical' | undefined,
      data: metadata.data as Record<string, unknown> | undefined,
    })
  },
}
