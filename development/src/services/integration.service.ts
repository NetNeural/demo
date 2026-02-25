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
   */
  async getNotificationLog(organizationId: string) {
    // This would need a new endpoint or direct database query
    // For now, return empty array as placeholder
    console.warn(
      'getNotificationLog not yet implemented in edge functions',
      organizationId
    )
    return []
  },
}
