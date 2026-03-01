import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import {
  logActivityStart,
  logActivityComplete,
  getIpAddress,
} from '../_shared/activity-logger.ts'
import { GoliothClient } from '../_shared/golioth-client.ts'
import { AwsIotClient } from '../_shared/aws-iot-client.ts'
import { AzureIotClient } from '../_shared/azure-iot-client.ts'
import { MqttClient } from '../_shared/mqtt-client.ts'
import type { BaseIntegrationClient } from '../_shared/base-integration-client.ts'

export default createEdgeFunction(
  async ({ req, supabase }) => {
    // Read integrationId from body (preferred) or URL path (fallback)
    const body = await req.json().catch(() => ({}))
    const url = new URL(req.url)
    const pathSegment = url.pathname.split('/').pop()
    const integrationId =
      body.integrationId ||
      body.integration_id ||
      (pathSegment !== 'integration-test' ? pathSegment : undefined)

    // Use the authenticated supabase client provided by createEdgeFunction
    // (replaces deprecated supabaseClient.auth.setAuth() from v1)
    const supabaseClient = supabase!

    if (req.method === 'POST') {
      const startTime = Date.now()

      if (!integrationId) {
        throw new DatabaseError('Integration ID is required', 400)
      }

      const { data: integration, error } = await supabaseClient
        .from('device_integrations')
        .select(
          `
          *,
          organization:organizations(id, name, slug)
        `
        )
        .eq('id', integrationId)
        .single()

      if (error || !integration) {
        throw new DatabaseError('Integration not found', 404)
      }

      // Log test activity start
      const logId = await logActivityStart(supabaseClient, {
        organizationId: integration.organization_id,
        integrationId: integration.id,
        direction: 'outgoing',
        activityType: 'test_connection',
        method: 'POST',
        endpoint: `/functions/v1/integration-test/${integrationId}`,
        ipAddress: getIpAddress(req),
        userAgent: req.headers.get('user-agent') || undefined,
        metadata: {
          integrationType: integration.integration_type,
        },
      })

      // Create the appropriate integration client and call its test() method
      let testResult
      try {
        const client = createIntegrationClient(
          integration,
          supabaseClient,
          integration.organization_id,
          integration.id
        )

        if (client) {
          // Each client handles its own test logic with proper isolation
          testResult = await client.test()
        } else {
          // Notification-type integrations (email/slack/webhook) don't use
          // BaseIntegrationClient — test them inline with direct API calls
          testResult = await testNotificationIntegration(
            integration,
            supabaseClient
          )
        }
      } catch (error) {
        testResult = {
          success: false,
          message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        }
      }

      // Log test activity completion
      if (logId) {
        const responseTime = Date.now() - startTime
        await logActivityComplete(supabaseClient, logId, {
          status: testResult.success ? 'success' : 'failed',
          responseTimeMs: responseTime,
          // @ts-expect-error - TestResult shape compatible with responseBody
          responseBody: testResult,
          errorMessage: testResult.success ? undefined : testResult.message,
        })
      }

      return createSuccessResponse(testResult)
    }

    throw new Error('Method not allowed')
  },
  {
    allowedMethods: ['POST'],
  }
)

/**
 * Create the appropriate integration client based on the integration type
 * This ensures each integration has its own isolated client instance
 */
// deno-lint-ignore no-explicit-any
function createIntegrationClient(
  // deno-lint-ignore no-explicit-any
  integration: any,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  organizationId: string,
  integrationId: string
): BaseIntegrationClient | null {
  // Try config first (legacy), then settings (current standard)
  const settings = integration.config || integration.settings || {}

  try {
    switch (integration.integration_type) {
      case 'golioth':
        return new GoliothClient({
          type: 'golioth',
          settings: {
            apiKey: integration.api_key_encrypted || settings.apiKey,
            projectId: integration.project_id || settings.projectId,
            baseUrl: integration.base_url || settings.baseUrl,
          },
          organizationId,
          integrationId,
          supabase,
        })

      case 'aws_iot':
      case 'aws-iot':
        return new AwsIotClient({
          type: 'aws-iot',
          settings: {
            region: integration.region || settings.region,
            accessKeyId:
              integration.access_key_id ||
              settings.accessKeyId ||
              settings.access_key_id,
            secretAccessKey:
              integration.secret_access_key ||
              settings.secretAccessKey ||
              settings.secret_access_key,
            endpoint: integration.endpoint || settings.endpoint,
          },
          organizationId,
          integrationId,
          supabase,
        })

      case 'azure_iot':
      case 'azure-iot':
        return new AzureIotClient({
          type: 'azure-iot',
          settings: {
            connectionString:
              integration.connection_string ||
              settings.connectionString ||
              settings.connection_string,
            hubName:
              integration.hub_name || settings.hubName || settings.hub_name,
          },
          organizationId,
          integrationId,
          supabase,
        })

      case 'mqtt':
      case 'mqtt_hosted':
      case 'mqtt_external':
        return new MqttClient({
          type: 'mqtt',
          settings: {
            brokerUrl:
              integration.broker_url ||
              settings.brokerUrl ||
              settings.broker_url,
            port: integration.port || settings.port,
            clientId:
              integration.client_id || settings.clientId || settings.client_id,
            username: integration.username || settings.username,
            password: integration.password || settings.password,
            useTls: integration.use_tls || settings.useTls || settings.use_tls,
            topicPrefix:
              integration.topic_prefix ||
              settings.topicPrefix ||
              settings.topic_prefix,
          },
          organizationId,
          integrationId,
          supabase,
        })

      default:
        console.error(
          `[integration-test] Unsupported integration type: ${integration.integration_type}`
        )
        return null
    }
  } catch (error) {
    console.error(
      `[integration-test] Error creating client for ${integration.integration_type}:`,
      error
    )
    return null
  }
}

// ============================================================================
// Notification Integration Tests (Email / Slack / Webhook)
// ============================================================================
// These providers don't extend BaseIntegrationClient. We test them by
// calling their external API directly to verify connectivity and credentials.
// ============================================================================

// deno-lint-ignore no-explicit-any
async function testNotificationIntegration(
  // deno-lint-ignore no-explicit-any
  integration: any,
  // deno-lint-ignore no-explicit-any
  _supabase: any
): Promise<{ success: boolean; message: string; details: Record<string, unknown> }> {
  const settings = integration.config || integration.settings || {}
  const integrationType = integration.integration_type

  switch (integrationType) {
    case 'email':
    case 'email_smtp':
      return testEmailIntegration(integration, settings)

    case 'slack':
      return testSlackIntegration(integration, settings)

    case 'webhook':
    case 'webhook_outbound':
      return testWebhookIntegration(integration, settings)

    default:
      return {
        success: false,
        message: `Integration type '${integrationType}' is not supported for testing`,
        details: { integrationType },
      }
  }
}

/**
 * Test Email (Resend) integration by validating the API key
 * Calls Resend's /api-keys endpoint to verify the key is valid without sending mail.
 */
// deno-lint-ignore no-explicit-any
async function testEmailIntegration(
  // deno-lint-ignore no-explicit-any
  integration: any,
  // deno-lint-ignore no-explicit-any
  settings: any
): Promise<{ success: boolean; message: string; details: Record<string, unknown> }> {
  const apiKey =
    settings.apiKey ||
    settings.password ||
    integration.api_key_encrypted ||
    Deno.env.get('RESEND_API_KEY') ||
    ''

  if (!apiKey) {
    return {
      success: false,
      message: 'Email not configured: No Resend API key found. Set apiKey in integration settings or RESEND_API_KEY env var.',
      details: { provider: 'resend' },
    }
  }

  try {
    // Validate API key by listing API keys (lightweight, no side effects)
    const response = await fetch('https://api.resend.com/api-keys', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const fromEmail = settings.fromEmail || settings.from_email || 'noreply@netneural.ai'
      return {
        success: true,
        message: `Email integration connected via Resend (from: ${fromEmail})`,
        details: { provider: 'resend', fromEmail },
      }
    }

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        message: 'Invalid Resend API key. Check your API key in the integration settings.',
        details: { provider: 'resend', status: response.status },
      }
    }

    return {
      success: false,
      message: `Resend API returned HTTP ${response.status}: ${response.statusText}`,
      details: { provider: 'resend', status: response.status },
    }
  } catch (error) {
    return {
      success: false,
      message: `Cannot reach Resend API: ${(error as Error).message}`,
      details: { provider: 'resend' },
    }
  }
}

/**
 * Test Slack integration by sending a lightweight test message to the webhook URL
 */
// deno-lint-ignore no-explicit-any
async function testSlackIntegration(
  // deno-lint-ignore no-explicit-any
  integration: any,
  // deno-lint-ignore no-explicit-any
  settings: any
): Promise<{ success: boolean; message: string; details: Record<string, unknown> }> {
  const webhookUrl = integration.webhook_url || settings.webhook_url || ''

  if (!webhookUrl) {
    return {
      success: false,
      message: 'Slack not configured: No webhook URL found. Add an Incoming Webhook URL in the integration settings.',
      details: { provider: 'slack' },
    }
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: ':white_check_mark: NetNeural integration test — connection verified.',
        username: 'NetNeural Bot',
        icon_emoji: ':robot_face:',
      }),
    })

    if (response.ok) {
      const channel = integration.webhook_secret || settings.channel || '#general'
      return {
        success: true,
        message: `Slack webhook connected (channel: ${channel})`,
        details: { provider: 'slack', channel },
      }
    }

    if (response.status === 404) {
      return {
        success: false,
        message: 'Slack webhook URL not found (404). The webhook may have been deleted in Slack.',
        details: { provider: 'slack', status: 404 },
      }
    }

    if (response.status === 403 || response.status === 410) {
      return {
        success: false,
        message: 'Slack webhook is disabled or revoked. Create a new Incoming Webhook in Slack.',
        details: { provider: 'slack', status: response.status },
      }
    }

    return {
      success: false,
      message: `Slack webhook returned HTTP ${response.status}: ${response.statusText}`,
      details: { provider: 'slack', status: response.status },
    }
  } catch (error) {
    return {
      success: false,
      message: `Cannot reach Slack webhook: ${(error as Error).message}`,
      details: { provider: 'slack' },
    }
  }
}

/**
 * Test Webhook (outbound) integration by sending a test POST to the configured URL
 */
// deno-lint-ignore no-explicit-any
async function testWebhookIntegration(
  // deno-lint-ignore no-explicit-any
  integration: any,
  // deno-lint-ignore no-explicit-any
  settings: any
): Promise<{ success: boolean; message: string; details: Record<string, unknown> }> {
  const webhookUrl = integration.webhook_url || settings.url || ''

  if (!webhookUrl) {
    return {
      success: false,
      message: 'Webhook not configured: No URL found. Set the destination URL in the integration settings.',
      details: { provider: 'webhook' },
    }
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'NetNeural-Webhook/1.0',
    }

    // Add HMAC signature if secret is configured
    const secret = integration.webhook_secret || settings.secret
    const payload = JSON.stringify({
      event: 'test',
      message: 'NetNeural webhook integration test',
      timestamp: new Date().toISOString(),
    })

    if (secret) {
      const encoder = new TextEncoder()
      const keyData = encoder.encode(secret)
      const data = encoder.encode(payload)
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, data)
      const hexSig = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      headers['X-Webhook-Signature'] = hexSig
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: payload,
    })

    if (response.ok || response.status === 204) {
      return {
        success: true,
        message: `Webhook endpoint reachable (HTTP ${response.status})`,
        details: { provider: 'webhook', url: webhookUrl, status: response.status },
      }
    }

    return {
      success: false,
      message: `Webhook endpoint returned HTTP ${response.status}: ${response.statusText}`,
      details: { provider: 'webhook', url: webhookUrl, status: response.status },
    }
  } catch (error) {
    return {
      success: false,
      message: `Cannot reach webhook endpoint: ${(error as Error).message}. Check the URL is correct and accessible.`,
      details: { provider: 'webhook', url: webhookUrl },
    }
  }
}
