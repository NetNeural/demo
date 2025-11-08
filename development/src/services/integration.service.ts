/**
 * Integration Services
 * Provides easy-to-use functions for triggering integrations
 */

import { createClient } from '@/lib/supabase/client'
import { handleApiError } from '@/lib/api-error-handler'

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

    const errorResult = handleApiError(response, {
      errorPrefix: 'Failed to send notification',
      throwOnError: false,
    })

    if (errorResult.isAuthError) {
      throw new Error('Not authenticated')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
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
   * Now uses unified device-sync endpoint
   */
  async syncAwsIot(options: SyncOptions) {
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
          organizationId: options.organizationId,
          integrationId: options.integrationId,
          operation: options.operation,
          deviceIds: options.deviceIds,
        }),
      }
    )

    const errorResult = handleApiError(response, {
      errorPrefix: 'Failed to sync with AWS IoT',
      throwOnError: false,
    })

    if (errorResult.isAuthError) {
      throw new Error('Not authenticated')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'Failed to sync with AWS IoT')
    }

    return await response.json()
  },

  /**
   * Sync devices with Golioth (uses unified device-sync function)
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
          organizationId: options.organizationId,
          integrationId: options.integrationId,
          operation: options.operation,
          deviceIds: options.deviceIds,
        }),
      }
    )

    const errorResult = handleApiError(response, {
      errorPrefix: 'Failed to sync with Golioth',
      throwOnError: false,
    })

    if (errorResult.isAuthError) {
      throw new Error('Not authenticated')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'Failed to sync with Golioth')
    }

    return await response.json()
  },

  /**
   * Sync devices with Azure IoT Hub
   * Now uses unified device-sync endpoint
   */
  async syncAzureIot(options: SyncOptions) {
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
          organizationId: options.organizationId,
          integrationId: options.integrationId,
          operation: options.operation,
          deviceIds: options.deviceIds,
        }),
      }
    )

    const errorResult2 = handleApiError(response, {
      errorPrefix: 'Azure IoT sync failed',
      throwOnError: false,
    })

    if (errorResult2.isAuthError) {
      throw new Error('Not authenticated')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'Azure IoT sync failed')
    }

    return response.json()
  },

  /**
   * Sync devices with Google Cloud IoT Core
   * Now uses unified device-sync endpoint
   */
  async syncGoogleIot(options: SyncOptions) {
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
          organizationId: options.organizationId,
          integrationId: options.integrationId,
          operation: options.operation,
          deviceIds: options.deviceIds,
        }),
      }
    )

    const errorResult3 = handleApiError(response, {
      errorPrefix: 'Google Cloud IoT sync failed',
      throwOnError: false,
    })

    if (errorResult3.isAuthError) {
      throw new Error('Not authenticated')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
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

    const errorResult4 = handleApiError(response, {
      errorPrefix: 'MQTT publish failed',
      throwOnError: false,
    })

    if (errorResult4.isAuthError) {
      throw new Error('Not authenticated')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
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

    const errorResult5 = handleApiError(response, {
      errorPrefix: 'MQTT subscribe failed',
      throwOnError: false,
    })

    if (errorResult5.isAuthError) {
      throw new Error('Not authenticated')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'MQTT subscribe failed')
    }

    return response.json()
  },

  /**
   * Test an integration configuration
   */
  async testIntegration(integrationId: string, integrationType: string) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Not authenticated')
    }
    
    switch (integrationType) {
      case 'golioth':
      case 'aws_iot':
      case 'azure_iot':
      case 'google_iot':
      case 'mqtt':
        // Test IoT platform connection using integration-test endpoint
        const testResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/integration-test/${integrationId}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        )

        const testErrorResult = handleApiError(testResponse, {
          errorPrefix: `Failed to test ${integrationType} connection`,
          throwOnError: false,
        })

        if (testErrorResult.isAuthError) {
          throw new Error('Not authenticated')
        }

        if (!testResponse.ok) {
          const error = await testResponse.json().catch(() => ({}))
          throw new Error(error.error || `Failed to test ${integrationType} connection`)
        }

        return await testResponse.json()
      
      case 'email':
      case 'slack':
      case 'webhook':
        // Test notification integrations using send-notification with test flag
        // First fetch the integration to get organization_id
        const { data: integration, error: integrationError } = await supabase
          .from('device_integrations')
          .select('organization_id')
          .eq('id', integrationId)
          .single()

        if (integrationError || !integration) {
          throw new Error('Integration not found')
        }

        const notificationResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-notification?test=true`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              organization_id: integration.organization_id,
              integration_type: integrationType,
              integration_id: integrationId,
              subject: integrationType === 'email' ? 'NetNeural Test Message' : undefined,
              message: `This is a test ${integrationType} notification from NetNeural.`,
              recipients: integrationType === 'email' ? ['test@example.com'] : undefined,
              data: { test: true, timestamp: new Date().toISOString() },
            }),
          }
        )

        const notificationErrorResult = handleApiError(notificationResponse, {
          errorPrefix: `Failed to send test ${integrationType}`,
          throwOnError: false,
        })

        if (notificationErrorResult.isAuthError) {
          throw new Error('Not authenticated')
        }

        if (!notificationResponse.ok) {
          const error = await notificationResponse.json().catch(() => ({}))
          throw new Error(error.error || `Failed to send test ${integrationType}`)
        }

        return await notificationResponse.json()
      
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
