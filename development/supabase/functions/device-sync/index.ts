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
//
// Operations:
// - test: Verify connection to integration
// - import: Import devices from external platform to NetNeural
// - export: Export devices from NetNeural to external platform
// - bidirectional: Two-way sync (import + export)
//
// Version: 2.0.0 (Unified Pattern)
// Date: 2025-11-07
// ============================================================================
// deno-lint-ignore-file no-explicit-any

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoliothClient } from '../_shared/golioth-client.ts'
import { AwsIotClient } from '../_shared/aws-iot-client.ts'
import { AzureIotClient } from '../_shared/azure-iot-client.ts'
import { GoogleIotClient } from '../_shared/google-iot-client.ts'
import { MqttClient } from '../_shared/mqtt-client.ts'
import type { BaseIntegrationClient, SyncResult, TestResult } from '../_shared/base-integration-client.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncRequest {
  integrationId: string
  organizationId: string
  operation: 'test' | 'import' | 'export' | 'bidirectional'
  deviceIds?: string[]
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      console.error('[device-sync] Missing environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { integrationId, organizationId, operation, deviceIds }: SyncRequest = await req.json()

    if (!integrationId || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: integrationId, organizationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['test', 'import', 'export', 'bidirectional'].includes(operation)) {
      return new Response(
        JSON.stringify({ error: 'Invalid operation. Must be: test, import, export, or bidirectional' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the appropriate client based on integration type
    const client = createIntegrationClient(integration, supabase, organizationId, integrationId)
    
    if (!client) {
      return new Response(
        JSON.stringify({ error: `Unsupported integration type: ${integration.integration_type}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
      return new Response(
        JSON.stringify(testResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      const syncResult = result as SyncResult
      return new Response(
        JSON.stringify({ success: true, ...syncResult }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('[device-sync] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Create the appropriate integration client based on the integration type
 */
function createIntegrationClient(
  integration: any,
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  integrationId: string
): BaseIntegrationClient | null {
  const settings = integration.config || {}
  
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

    case 'google_iot':
    case 'google-iot':
      return new GoogleIotClient({
        type: 'google-iot',
        settings: {
          projectId: settings.projectId || settings.project_id,
          region: settings.region,
          registryId: settings.registryId || settings.registry_id,
          serviceAccountKey: settings.serviceAccountKey || settings.service_account_key || '',
        },
        organizationId,
        integrationId,
        supabase,
      })

    case 'mqtt':
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
