import { createEdgeFunction, createSuccessResponse, DatabaseError } from '../_shared/request-handler.ts'
import { logActivityStart, logActivityComplete, getIpAddress } from '../_shared/activity-logger.ts'
import { GoliothClient } from '../_shared/golioth-client.ts'
import { AwsIotClient } from '../_shared/aws-iot-client.ts'
import { AzureIotClient } from '../_shared/azure-iot-client.ts'
import { MqttClient } from '../_shared/mqtt-client.ts'
import type { BaseIntegrationClient } from '../_shared/base-integration-client.ts'

export default createEdgeFunction(async ({ req, supabase }) => {
  // Read integrationId from body (preferred) or URL path (fallback)
  const body = await req.json().catch(() => ({}))
  const url = new URL(req.url)
  const pathSegment = url.pathname.split('/').pop()
  const integrationId = body.integrationId || body.integration_id || (pathSegment !== 'integration-test' ? pathSegment : undefined)

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
        .select(`
          *,
          organization:organizations(id, name, slug)
        `)
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
          testResult = {
            success: false,
            message: `Integration type ${integration.integration_type} is not supported for testing`,
            details: {}
          }
        }
      } catch (error) {
        testResult = {
          success: false,
          message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { error: error instanceof Error ? error.message : String(error) }
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
}, {
  allowedMethods: ['POST']
})

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
            accessKeyId: integration.access_key_id || settings.accessKeyId || settings.access_key_id,
            secretAccessKey: integration.secret_access_key || settings.secretAccessKey || settings.secret_access_key,
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
            connectionString: integration.connection_string || settings.connectionString || settings.connection_string,
            hubName: integration.hub_name || settings.hubName || settings.hub_name,
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
            brokerUrl: integration.broker_url || settings.brokerUrl || settings.broker_url,
            port: integration.port || settings.port,
            clientId: integration.client_id || settings.clientId || settings.client_id,
            username: integration.username || settings.username,
            password: integration.password || settings.password,
            useTls: integration.use_tls || settings.useTls || settings.use_tls,
            topicPrefix: integration.topic_prefix || settings.topicPrefix || settings.topic_prefix,
          },
          organizationId,
          integrationId,
          supabase,
        })

      default:
        console.error(`[integration-test] Unsupported integration type: ${integration.integration_type}`)
        return null
    }
  } catch (error) {
    console.error(`[integration-test] Error creating client for ${integration.integration_type}:`, error)
    return null
  }
}

