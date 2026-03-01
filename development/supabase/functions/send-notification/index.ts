// ============================================================================
// SEND NOTIFICATION EDGE FUNCTION
// ============================================================================
// Handles sending notifications via Email, Slack, and Custom Webhooks
// Supports alert notifications, device status updates, and custom events
//
// EMAIL ARCHITECTURE (consolidated):
//   Provider: Resend (https://resend.com)
//   Config:   Per-integration apiKey + fromEmail, or RESEND_API_KEY env var
//   UI:       EmailConfigDialog.tsx collects Resend API key + from address
//
//   Related edge functions:
//     send-notification/     → This file: general notification sending (email/slack/webhook)
//     send-alert-email/      → Alert-specific emails with rich HTML (called by send-alert-notifications)
//     send-alert-notifications/ → Alert orchestrator: email + Slack + SMS channels
//     send-email/            → General-purpose email sender (reports, platform comms)
//
// Version: 2.0.0
// Date: 2026-03-01
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
  apiKey?: string
  fromEmail?: string
  fromName?: string
  provider?: string
  // Legacy SMTP fields (migrated to Resend API)
  smtp_host?: string
  smtp_port?: number
  username?: string
  password?: string
  from_email?: string
  from_name?: string
  use_tls?: boolean
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
  // Resolve API key: prefer config.apiKey, fall back to legacy password field, then env var
  const apiKey =
    config.apiKey ||
    config.password ||
    Deno.env.get('RESEND_API_KEY') ||
    ''

  if (!apiKey) {
    throw new Error(
      'Email not configured: No Resend API key found. Set apiKey in integration config or RESEND_API_KEY env var.'
    )
  }

  const fromEmail = config.fromEmail || config.from_email || 'noreply@netneural.ai'
  const fromName = config.fromName || config.from_name || 'NetNeural'

  console.log('Sending email via Resend:', {
    subject,
    recipients,
    from: `${fromName} <${fromEmail}>`,
  })

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: recipients,
      subject,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #0ea5e9; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0;">${subject}</h2>
    </div>
    <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
      <p>${message.replace(/\n/g, '<br>')}</p>
    </div>
    <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">
      NetNeural IoT Platform
    </div>
  </div>
</div>`,
      text: message,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(
      `Email send failed: ${(errorBody as any).message || response.statusText}`
    )
  }

  const result = await response.json()
  return { success: true, sent_to: recipients, id: (result as any).id }
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
          ? 'resend-api'
          : integration_type === 'slack'
            ? integrations.webhook_url || ''
            : integrations.webhook_url || '',
      metadata: {
        priority,
        recipient_count: recipients?.length || 0,
        has_subject: !!subject,
        is_test: isTest,
        recipients: recipients || [],
        subject: subject || '',
        message: message,
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

          // Build email config from integration settings (supports both new Resend and legacy SMTP shapes)
          const rawConfig = integrations.api_key_encrypted
            ? JSON.parse(integrations.api_key_encrypted)
            : {}
          const settingsConfig = integrations.settings || {}
          const emailConfig: EmailConfig = {
            apiKey: settingsConfig.apiKey || rawConfig.apiKey || rawConfig.password,
            fromEmail:
              settingsConfig.fromEmail || rawConfig.fromEmail || rawConfig.from_email,
            fromName:
              settingsConfig.fromName || rawConfig.fromName || rawConfig.from_name,
            provider: settingsConfig.provider || 'resend',
          }
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
