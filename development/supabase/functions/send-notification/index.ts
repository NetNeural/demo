// ============================================================================
// SEND NOTIFICATION EDGE FUNCTION
// ============================================================================
// Handles sending notifications via Email, Slack, and Custom Webhooks
// Supports alert notifications, device status updates, and custom events
//
// Version: 1.0.0
// Date: 2025-10-27
// ============================================================================

import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import {
  logActivityStart,
  logActivityComplete,
} from '../_shared/activity-logger.ts'

interface NotificationPayload {
  organization_id: string
  integration_type: 'email' | 'slack' | 'webhook'
  integration_id?: string
  subject?: string
  message: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  data?: Record<string, unknown>
  recipients?: string[]
}

interface EmailConfig {
  smtp_host: string
  smtp_port: number
  username: string
  password: string
  from_email: string
  from_name?: string
  use_tls: boolean
}

interface SlackConfig {
  webhook_url: string
  channel: string
  username?: string
  icon_emoji?: string
}

interface WebhookConfig {
  url: string
  secret?: string
  method: 'POST' | 'PUT'
  content_type: string
  custom_headers?: string
}

async function sendEmail(
  config: EmailConfig,
  subject: string,
  message: string,
  recipients: string[]
) {
  // Use SMTP to send email
  // For Deno, we'll use a simple fetch to a mail service API or SMTP relay

  console.log('Sending email:', {
    subject,
    recipients,
    config: { ...config, password: '[REDACTED]' },
  })

  // TODO: Implement actual SMTP sending
  // Options:
  // 1. Use SendGrid/Mailgun API (recommended)
  // 2. Use nodemailer equivalent for Deno
  // 3. Use SMTP relay service

  // Placeholder implementation using a hypothetical mail service
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.password}`, // Assuming password is API key
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: recipients.map((email) => ({ to: [{ email }] })),
      from: { email: config.from_email, name: config.from_name || 'NetNeural' },
      subject,
      content: [{ type: 'text/plain', value: message }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Email send failed: ${response.statusText}`)
  }

  return { success: true, sent_to: recipients }
}

async function sendSlack(
  config: SlackConfig,
  message: string,
  data?: Record<string, unknown>
) {
  const payload = {
    channel: config.channel,
    username: config.username || 'NetNeural Bot',
    icon_emoji: config.icon_emoji || ':robot_face:',
    text: message,
    attachments: data
      ? [
          {
            color:
              data.priority === 'critical'
                ? 'danger'
                : data.priority === 'high'
                  ? 'warning'
                  : 'good',
            fields: Object.entries(data).map(([key, value]) => ({
              title: key,
              value: String(value),
              short: true,
            })),
          },
        ]
      : undefined,
  }

  const response = await fetch(config.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Slack send failed: ${response.statusText}`)
  }

  return { success: true, channel: config.channel }
}

async function sendWebhook(
  config: WebhookConfig,
  message: string,
  data?: Record<string, unknown>
) {
  const payload = {
    message,
    timestamp: new Date().toISOString(),
    ...data,
  }

  const headers: Record<string, string> = {
    'Content-Type': config.content_type || 'application/json',
    'User-Agent': 'NetNeural-Webhook/1.0',
  }

  // Add custom headers if provided
  if (config.custom_headers) {
    try {
      const customHeaders = JSON.parse(config.custom_headers)
      Object.assign(headers, customHeaders)
    } catch (e) {
      console.warn('Failed to parse custom headers:', e)
    }
  }

  // Add signature if secret is provided
  if (config.secret) {
    const signature = await createWebhookSignature(
      JSON.stringify(payload),
      config.secret
    )
    headers['X-Webhook-Signature'] = signature
  }

  const response = await fetch(config.url, {
    method: config.method || 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Webhook send failed: ${response.statusText}`)
  }

  return { success: true, url: config.url, status: response.status }
}

async function createWebhookSignature(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(payload)
  const keyData = encoder.encode(secret)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data)
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default createEdgeFunction(
  async ({ req }) => {
    // Check if this is a test request
    const url = new URL(req.url)
    const isTest = url.searchParams.get('test') === 'true'

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new DatabaseError('Missing authorization header', 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new DatabaseError('Unauthorized', 401)
    }

    // Parse request body
    const payload: NotificationPayload = await req.json()
    const {
      organization_id,
      integration_type,
      integration_id,
      subject,
      message,
      priority = 'medium',
      data,
      recipients,
    } = payload

    if (!organization_id || !integration_type || !message) {
      throw new Error(
        'Missing required fields: organization_id, integration_type, message'
      )
    }

    // Get integration configuration
    let integrationQuery = supabase
      .from('device_integrations')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('integration_type', integration_type)
      .eq('status', 'active')

    if (integration_id) {
      integrationQuery = integrationQuery.eq('id', integration_id)
    }

    const { data: integrations, error: intError } = await integrationQuery
      .limit(1)
      .single()

    if (intError || !integrations) {
      throw new DatabaseError(
        `No active ${integration_type} integration found for this organization`,
        404
      )
    }

    let result
    const startTime = Date.now()

    // Start activity logging
    const activityType =
      integration_type === 'email'
        ? 'notification_email'
        : integration_type === 'slack'
          ? 'notification_slack'
          : 'notification_webhook'

    const logId = await logActivityStart(supabase, {
      organizationId: organization_id,
      integrationId: integrations.id,
      direction: 'outgoing',
      activityType,
      method: 'POST',
      endpoint:
        integration_type === 'email'
          ? 'smtp'
          : integration_type === 'slack'
            ? integrations.webhook_url || ''
            : integrations.webhook_url || '',
      metadata: {
        priority,
        recipient_count: recipients?.length || 0,
        has_subject: !!subject,
        is_test: isTest,
      },
    })

    try {
      // If test mode, use test data
      const testRecipients = isTest ? ['test@example.com'] : recipients
      const testSubject = isTest
        ? '[TEST] NetNeural Test Notification'
        : subject
      const testMessage = isTest
        ? `This is a test notification.\n\nActual message would be:\n${message}`
        : message

      // Send notification based on integration type
      switch (integration_type) {
        case 'email': {
          const effectiveRecipients = testRecipients || recipients
          if (!effectiveRecipients || effectiveRecipients.length === 0) {
            throw new Error('Recipients required for email notifications')
          }

          const emailConfig: EmailConfig = JSON.parse(
            integrations.api_key_encrypted || '{}'
          )
          result = await sendEmail(
            emailConfig,
            testSubject || 'NetNeural Notification',
            testMessage,
            effectiveRecipients
          )
          break
        }

        case 'slack': {
          const slackConfig: SlackConfig = {
            webhook_url: integrations.webhook_url || '',
            channel: integrations.webhook_secret || '#general',
          }
          result = await sendSlack(slackConfig, testMessage, {
            ...data,
            is_test: isTest,
          })
          break
        }

        case 'webhook': {
          const webhookConfig: WebhookConfig = {
            url: integrations.webhook_url || '',
            secret: integrations.webhook_secret,
            method: 'POST',
            content_type: 'application/json',
          }
          result = await sendWebhook(webhookConfig, testMessage, {
            ...data,
            is_test: isTest,
          })
          break
        }

        default:
          throw new Error(`Unsupported integration type: ${integration_type}`)
      }

      const duration = Date.now() - startTime

      // Log activity completion
      if (logId) {
        // @ts-expect-error - responseBody accepts result shape
        await logActivityComplete(supabase, logId, {
          status: 'success',
          responseTimeMs: duration,
          responseBody: result,
        })
      }

      return createSuccessResponse({ success: true, result })
    } catch (sendError) {
      const duration = Date.now() - startTime

      // Log failure
      if (logId) {
        await logActivityComplete(supabase, logId, {
          status: 'failed',
          responseTimeMs: duration,
          errorMessage:
            sendError instanceof Error
              ? sendError.message
              : 'Notification send failed',
        })
      }

      throw sendError
    }
  },
  {
    allowedMethods: ['POST'],
  }
)
