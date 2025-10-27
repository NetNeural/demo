/**
 * Integration Services
 * Provides easy-to-use functions for triggering integrations
 */

import { createClient } from '@/lib/supabase/client'

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
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-notification`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: options.organizationId,
          integration_type: options.integrationType,
          integration_id: options.integrationId,
          subject: options.subject,
          message: options.message,
          priority: options.priority,
          data: options.data,
          recipients: options.recipients,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send notification')
    }

    return await response.json()
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
   */
  async syncAwsIot(options: SyncOptions) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/aws-iot-sync`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: options.organizationId,
          integration_id: options.integrationId,
          operation: options.operation,
          device_ids: options.deviceIds,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to sync with AWS IoT')
    }

    return await response.json()
  },

  /**
   * Sync devices with Golioth (uses existing device-sync function)
   */
  async syncGolioth(options: SyncOptions) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/device-sync`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: options.organizationId,
          integration_id: options.integrationId,
          operation: options.operation,
          device_ids: options.deviceIds,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to sync with Golioth')
    }

    return await response.json()
  },

  /**
   * Sync devices with Azure IoT Hub
   */
  async syncAzureIot(options: SyncOptions) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/azure-iot-sync`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: options.organizationId,
          integration_id: options.integrationId,
          operation: options.operation,
          device_ids: options.deviceIds,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Azure IoT sync failed')
    }

    return response.json()
  },

  /**
   * Sync devices with Google Cloud IoT Core
   */
  async syncGoogleIot(options: SyncOptions) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/google-iot-sync`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: options.organizationId,
          integration_id: options.integrationId,
          operation: options.operation,
          device_ids: options.deviceIds,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Google Cloud IoT sync failed')
    }

    return response.json()
  },

  /**
   * Publish message to MQTT broker
   */
  async publishMqtt(
    organizationId: string,
    integrationId: string,
    messages: Array<{ topic: string; payload: string | object; qos?: 0 | 1 | 2; retain?: boolean }>
  ) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mqtt-broker`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: organizationId,
          integration_id: integrationId,
          operation: 'publish',
          messages,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'MQTT publish failed')
    }

    return response.json()
  },

  /**
   * Subscribe to MQTT topics
   */
  async subscribeMqtt(
    organizationId: string,
    integrationId: string,
    topics: string[],
    callbackUrl?: string
  ) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mqtt-broker`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: organizationId,
          integration_id: integrationId,
          operation: 'subscribe',
          topics,
          callback_url: callbackUrl,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'MQTT subscribe failed')
    }

    return response.json()
  },

  /**
   * Test an integration configuration
   */
  async testIntegration(integrationId: string, integrationType: string) {
    const supabase = createClient()
    
    switch (integrationType) {
      case 'email':
        // Send test email
        return this.sendNotification({
          organizationId: '', // Will be fetched from integration
          integrationType: 'email',
          integrationId,
          subject: 'Test Email from NetNeural',
          message: 'This is a test email to verify your email integration is working correctly.',
          recipients: ['test@example.com'], // Should be configurable
        })
      
      case 'slack':
        // Send test Slack message
        return this.sendNotification({
          organizationId: '',
          integrationType: 'slack',
          integrationId,
          message: '🧪 Test message from NetNeural - your Slack integration is working!',
        })
      
      case 'webhook':
        // Trigger test webhook
        return this.sendNotification({
          organizationId: '',
          integrationType: 'webhook',
          integrationId,
          message: 'Test webhook trigger',
          data: { test: true, timestamp: new Date().toISOString() },
        })
      
      case 'mqtt':
        // Test MQTT connection
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          throw new Error('Not authenticated')
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mqtt-broker`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              organization_id: '',
              integration_id: integrationId,
              operation: 'test',
            }),
          }
        )

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'MQTT test failed')
        }

        return response.json()
      
      default:
        throw new Error(`Testing not implemented for ${integrationType}`)
    }
  },

  /**
   * Get notification history for an organization
   */
  async getNotificationLog(organizationId: string, limit: number = 50) {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('notification_log')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data
  },
}
