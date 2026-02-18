// ============================================================================
// DEVICE SYNC EDGE FUNCTION - UNIFIED
// ============================================================================
// Handles bidirectional sync between NetNeural and all IoT platforms
// Uses the unified BaseIntegrationClient pattern for consistency
//
// Supported Platforms:
// - Golioth
// - AWS IoT Core
// - Azure IoT Hub
// - Google Cloud IoT Core
// - MQTT Brokers
// - NetNeural Hub (Multi-Protocol)
//
// Operations:
// - test: Verify connection to integration
// - import: Import devices from external platform to NetNeural
// - export: Export devices from NetNeural to external platform
// - bidirectional: Two-way sync (import + export)
//
// Version: 2.0.1 (UUID fix deployed 2025-11-14)
// Date: 2025-11-07
// ============================================================================
// deno-lint-ignore-file no-explicit-any

import { createEdgeFunction, createSuccessResponse, DatabaseError } from '../_shared/request-handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoliothClient } from '../_shared/golioth-client.ts'
import { AwsIotClient } from '../_shared/aws-iot-client.ts'
import { AzureIotClient } from '../_shared/azure-iot-client.ts'
import { MqttClient } from '../_shared/mqtt-client.ts'
import { NetNeuralHubClient } from '../_shared/netneural-hub-client.ts'
import { detectConflict, logConflict } from '../_shared/base-integration-client.ts'
import type { BaseIntegrationClient, SyncResult, TestResult, Device } from '../_shared/base-integration-client.ts'

interface SyncRequest {
  integrationId: string
  organizationId: string
  operation: 'test' | 'import' | 'export' | 'bidirectional'
  deviceIds?: string[]
}

export default createEdgeFunction(async ({ req }) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseKey) {
    console.error('[device-sync] Missing environment variables')
    throw new DatabaseError('Server configuration error', 500)
  }

  const { integrationId, organizationId, operation, deviceIds }: SyncRequest = await req.json()

  if (!integrationId || !organizationId) {
    throw new Error('Missing required fields: integrationId, organizationId')
  }

  if (!['test', 'import', 'export', 'bidirectional'].includes(operation)) {
    throw new Error('Invalid operation. Must be: test, import, export, or bidirectional')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  
  // Fetch integration from database
  const { data: integration, error: integrationError } = await supabase
    .from('device_integrations')
    .select('*')
    .eq('id', integrationId)
    .eq('organization_id', organizationId)
    .single()

  if (integrationError || !integration) {
    console.error('[device-sync] Integration not found:', integrationError)
    throw new DatabaseError('Integration not found', 404)
  }

  // Determine settings source (schema uses 'settings', older code used 'config')
  // Prefer integration.settings if present; fall back to integration.config
  const rawSettings = (integration as any).settings || (integration as any).config || {}

  console.log('[device-sync] Integration record snapshot (sanitized):', {
    id: integration.id,
    type: integration.integration_type,
    hasEncryptedKey: !!integration.api_key_encrypted,
    encryptedKeyLength: integration.api_key_encrypted?.length || 0,
    project_id: integration.project_id,
    settingsKeys: Object.keys(rawSettings),
    settingsContainsApiKey: !!rawSettings.apiKey,
    settingsContainsProjectId: !!rawSettings.projectId,
  })

  // Create the appropriate client based on integration type (pass merged settings)
  const client = createIntegrationClient({ ...integration, config: rawSettings }, supabase, organizationId, integrationId)
  
  if (!client) {
    throw new Error(`Unsupported integration type: ${integration.integration_type}`)
  }

  // Execute the requested operation
  let result: TestResult | SyncResult

  switch (operation) {
    case 'test':
      console.log(`[device-sync] Testing ${integration.integration_type} connection...`)
      result = await client.test()
      break

    case 'import':
      console.log(`[device-sync] Importing from ${integration.integration_type}...`)
      result = await client.import()
      break

    case 'export':
      console.log(`[device-sync] Exporting to ${integration.integration_type}...`)
      // Fetch devices from NetNeural to export
      const devicesToExport = await getDevicesForExport(supabase, organizationId, deviceIds)
      result = await client.export(devicesToExport)
      break

    case 'bidirectional':
      console.log(`[device-sync] Bidirectional sync with ${integration.integration_type}...`)
      // Fetch devices from NetNeural for bidirectional sync
      const devicesForSync = await getDevicesForExport(supabase, organizationId, deviceIds)
      result = await client.bidirectionalSync(devicesForSync)
      break
  }

  console.log(`[device-sync] ${operation} completed:`, result)
  
  // Format response based on operation type
  if (operation === 'test') {
    const testResult = result as TestResult
    return createSuccessResponse(testResult)
  } else {
    const syncResult = result as SyncResult
    return createSuccessResponse({ success: true, ...syncResult })
  }
}, {
  requireAuth: false, // Using service role key, no user auth needed
  allowedMethods: ['POST']
})

/**
 * Perform conflict-aware device sync
 * Wraps the client's import/sync operation with conflict detection
 */
async function syncWithConflictDetection(
  client: BaseIntegrationClient,
  operation: 'import' | 'bidirectional',
  integration: any,
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  syncLogId?: string,
  devicesForSync?: Device[]
): Promise<SyncResult> {
  // Get conflict resolution strategy from settings
  const settings = (integration as any).settings || (integration as any).config || {}
  const conflictStrategy = settings.conflictResolution || 'remote_wins'
  
  console.log('[device-sync] Conflict detection enabled, strategy:', conflictStrategy)
  
  // Execute the sync operation
  const result = operation === 'import' 
    ? await client.import() 
    : await client.bidirectionalSync(devicesForSync || [])
  
  // Note: Conflict detection is now handled internally by the Golioth client
  // We keep this function for future enhancement and other integrations
  
  return result
}

/**
 * Create the appropriate integration client based on the integration type
 */
// deno-lint-ignore no-explicit-any
function createIntegrationClient(
  // deno-lint-ignore no-explicit-any
  integration: any, // expects merged config in integration.config
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  integrationId: string
): BaseIntegrationClient | null {
  const settings = integration.config || {}
  
  switch (integration.integration_type) {
    case 'golioth':
      console.log('[device-sync] Creating Golioth client with:', {
        hasApiKey: !!(integration.api_key_encrypted || settings.apiKey),
        apiKeySource: integration.api_key_encrypted ? 'integration.api_key_encrypted' : (settings.apiKey ? 'settings.apiKey' : 'missing'),
        apiKeyLength: (integration.api_key_encrypted || settings.apiKey)?.length || 0,
        projectId: integration.project_id || settings.projectId,
        projectIdSource: integration.project_id ? 'integration.project_id' : (settings.projectId ? 'settings.projectId' : 'missing'),
        baseUrl: integration.base_url || settings.baseUrl || 'https://api.golioth.io/v1'
      })
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
          region: settings.region,
          accessKeyId: settings.accessKeyId || settings.access_key_id,
          secretAccessKey: settings.secretAccessKey || settings.secret_access_key,
          endpoint: settings.endpoint,
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
          connectionString: settings.connectionString || settings.connection_string,
          hubName: settings.hubName || settings.hub_name,
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
          brokerUrl: settings.brokerUrl || settings.broker_url,
          port: settings.port,
          clientId: settings.clientId || settings.client_id,
          username: settings.username,
          password: settings.password,
          useTls: settings.useTls || settings.use_tls,
          topicPrefix: settings.topicPrefix || settings.topic_prefix,
        },
        organizationId,
        integrationId,
        supabase,
      })

    case 'netneural_hub':
      console.log('[device-sync] Creating NetNeural Hub client with:', {
        protocolsEnabled: Object.keys(settings.protocols || {}).filter(p => settings.protocols?.[p]?.enabled),
        deviceTypesSupported: Object.keys(settings.device_routing || {}),
        globalSettings: settings.global_settings
      })
      return new NetNeuralHubClient({
        type: 'netneural_hub' as any,
        settings: {
          protocols: settings.protocols || {},
          device_routing: settings.device_routing || {},
          global_settings: settings.global_settings || {
            max_retry_attempts: 3,
            device_discovery_enabled: true,
            auto_capability_detection: true
          }
        },
        organizationId,
        integrationId,
        supabase,
      })

    default:
      console.error(`[device-sync] Unsupported integration type: ${integration.integration_type}`)
      return null
  }
}

/**
 * Fetch devices from NetNeural database for export operations
 */
async function getDevicesForExport(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  deviceIds?: string[]
): Promise<any[]> {
  let query = supabase
    .from('devices')
    .select('*')
    .eq('organization_id', organizationId)

  if (deviceIds && deviceIds.length > 0) {
    query = query.in('id', deviceIds)
  }

  const { data: devices, error } = await query

  if (error) {
    console.error('[device-sync] Error fetching devices:', error)
    throw new Error(`Failed to fetch devices: ${error.message}`)
  }

  return devices || []
}
