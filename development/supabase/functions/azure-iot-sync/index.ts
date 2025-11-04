// ============================================================================
// AZURE IOT HUB SYNC EDGE FUNCTION
// ============================================================================
// Handles bidirectional sync between NetNeural and Azure IoT Hub
// Supports device twins, direct methods, and device lifecycle
//
// Version: 1.0.0
// Date: 2025-10-27
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { logActivityStart, logActivityComplete } from '../_shared/activity-logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AzureIotConfig {
  connection_string: string
  hub_name: string
  shared_access_key?: string
}

interface SyncOperation {
  organization_id: string
  integration_id: string
  operation: 'import' | 'export' | 'bidirectional'
  device_ids?: string[]
}

interface AzureDevice {
  deviceId: string
  status: 'enabled' | 'disabled'
  statusReason?: string
  connectionState: 'Connected' | 'Disconnected'
  lastActivityTime: string
  cloudToDeviceMessageCount: number
  authentication?: {
    symmetricKey?: { primaryKey: string; secondaryKey: string }
    x509Thumbprint?: { primaryThumbprint: string; secondaryThumbprint: string }
  }
}

interface DeviceTwin {
  deviceId: string
  etag: string
  version: number
  properties: {
    desired: Record<string, unknown>
    reported: Record<string, unknown>
  }
  tags: Record<string, unknown>
}

function parseConnectionString(connectionString: string) {
  const parts = connectionString.split(';')
  const config: Record<string, string> = {}
  
  parts.forEach(part => {
    const [key, ...valueParts] = part.split('=')
    config[key] = valueParts.join('=')
  })
  
  return {
    hostName: config.HostName,
    sharedAccessKeyName: config.SharedAccessKeyName,
    sharedAccessKey: config.SharedAccessKey,
  }
}

async function generateSasToken(resourceUri: string, keyName: string, key: string, expiryInMinutes: number = 60) {
  const expiry = Math.floor(Date.now() / 1000) + (expiryInMinutes * 60)
  const stringToSign = `${encodeURIComponent(resourceUri)}\n${expiry}`
  
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key)
  const data = encoder.encode(stringToSign)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data)
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
  
  return `SharedAccessSignature sr=${encodeURIComponent(resourceUri)}&sig=${encodeURIComponent(base64Signature)}&se=${expiry}&skn=${keyName}`
}

async function makeAzureRequest(endpoint: string, method: string, config: ReturnType<typeof parseConnectionString>, body?: string) {
  const resourceUri = config.hostName
  const sasToken = await generateSasToken(resourceUri, config.sharedAccessKeyName, config.sharedAccessKey)
  
  const headers: Record<string, string> = {
    'Authorization': sasToken,
    'Content-Type': 'application/json',
    'User-Agent': 'NetNeural-Azure-IoT/1.0',
  }
  
  const url = `https://${config.hostName}${endpoint}`
  
  const response = await fetch(url, {
    method,
    headers,
    body,
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Azure IoT Hub API error (${response.status}): ${errorText}`)
  }
  
  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    return await response.json()
  }
  
  return null
}

async function importFromAzure(
  config: ReturnType<typeof parseConnectionString>,
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  integrationId: string
) {
  const results = {
    devices_processed: 0,
    devices_succeeded: 0,
    devices_failed: 0,
    errors: [] as string[],
  }
  
  try {
    // List all devices from Azure IoT Hub
    const devices: AzureDevice[] = await makeAzureRequest(
      '/devices?api-version=2021-04-12',
      'GET',
      config
    )
    
    for (const device of devices || []) {
      results.devices_processed++
      
      try {
        // Get device twin for detailed state
        let twin: DeviceTwin | null = null
        try {
          twin = await makeAzureRequest(
            `/twins/${device.deviceId}?api-version=2021-04-12`,
            'GET',
            config
          )
        } catch (e) {
          console.warn(`Failed to get twin for ${device.deviceId}:`, e)
        }
        
        // Upsert device in NetNeural
        const { error } = await supabase
          .from('devices')
          .upsert({
            organization_id: organizationId,
            integration_id: integrationId,
            external_device_id: device.deviceId,
            name: device.deviceId,
            device_type: twin?.tags?.deviceType || 'unknown',
            status: device.connectionState === 'Connected' ? 'online' : 'offline',
            last_seen: device.lastActivityTime ? new Date(device.lastActivityTime) : null,
            metadata: {
              azure_status: device.status,
              azure_status_reason: device.statusReason,
              azure_twin: twin,
              azure_pending_messages: device.cloudToDeviceMessageCount,
            },
          }, {
            onConflict: 'organization_id,external_device_id',
          })
        
        if (error) {
          results.devices_failed++
          results.errors.push(`${device.deviceId}: ${error.message}`)
        } else {
          results.devices_succeeded++
        }
      } catch (error) {
        results.devices_failed++
        results.errors.push(`${device.deviceId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  } catch (error) {
    throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  return results
}

async function exportToAzure(
  config: ReturnType<typeof parseConnectionString>,
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  integrationId: string,
  deviceIds?: string[]
) {
  const results = {
    devices_processed: 0,
    devices_succeeded: 0,
    devices_failed: 0,
    errors: [] as string[],
  }
  
  try {
    // Get devices from NetNeural
    let query = supabase
      .from('devices')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('integration_id', integrationId)
    
    if (deviceIds && deviceIds.length > 0) {
      query = query.in('id', deviceIds)
    }
    
    const { data: devices, error: devicesError } = await query
    
    if (devicesError) {
      throw new Error(`Failed to fetch devices: ${devicesError.message}`)
    }
    
    for (const device of devices || []) {
      results.devices_processed++
      
      try {
        const deviceId = device.external_device_id || device.id
        
        // Create/update device in Azure IoT Hub
        const deviceBody = JSON.stringify({
          deviceId,
          status: device.status === 'offline' ? 'disabled' : 'enabled',
          statusReason: `Synced from NetNeural at ${new Date().toISOString()}`,
        })
        
        await makeAzureRequest(
          `/devices/${deviceId}?api-version=2021-04-12`,
          'PUT',
          config,
          deviceBody
        )
        
        // Update device twin with current state
        const twinBody = JSON.stringify({
          properties: {
            desired: {
              // Properties we want the device to have
              status: device.status,
              last_sync: new Date().toISOString(),
            },
          },
          tags: {
            deviceType: device.device_type,
            model: device.model,
            serialNumber: device.serial_number,
            firmwareVersion: device.firmware_version,
            location: device.location_id,
          },
        })
        
        await makeAzureRequest(
          `/twins/${deviceId}?api-version=2021-04-12`,
          'PATCH',
          config,
          twinBody
        )
        
        results.devices_succeeded++
      } catch (error) {
        results.devices_failed++
        results.errors.push(`${device.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  } catch (error) {
    throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  return results
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload: SyncOperation = await req.json()
    const { organization_id, integration_id, operation, device_ids } = payload

    if (!organization_id || !integration_id || !operation) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Azure IoT Hub integration config
    const { data: integration, error: intError } = await supabase
      .from('device_integrations')
      .select('*')
      .eq('id', integration_id)
      .eq('integration_type', 'azure_iot')
      .single()

    if (intError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Azure IoT Hub integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const azureConfig: AzureIotConfig = JSON.parse(integration.api_key_encrypted || '{}')
    const config = parseConnectionString(azureConfig.connection_string)

    let results
    const startTime = Date.now()
    
    // Start activity logging
    const activityType = operation === 'import' ? 'sync_import' : 
                        operation === 'export' ? 'sync_export' : 
                        'sync_bidirectional'
    
    const logId = await logActivityStart(supabase, {
      organizationId: organization_id,
      integrationId: integration_id,
      direction: 'outgoing',
      activityType,
      method: 'POST',
      endpoint: `https://${config.hostName}`,
      metadata: {
        operation,
        device_count: device_ids?.length || 0,
        hub_name: azureConfig.hub_name,
      }
    })

    try {
      switch (operation) {
        case 'import':
          results = await importFromAzure(config, supabase, organization_id, integration_id)
          break
        
        case 'export':
          results = await exportToAzure(config, supabase, organization_id, integration_id, device_ids)
          break
        
        case 'bidirectional':
          const importResults = await importFromAzure(config, supabase, organization_id, integration_id)
          const exportResults = await exportToAzure(config, supabase, organization_id, integration_id, device_ids)
          results = {
            import: importResults,
            export: exportResults,
            devices_processed: importResults.devices_processed + exportResults.devices_processed,
            devices_succeeded: importResults.devices_succeeded + exportResults.devices_succeeded,
            devices_failed: importResults.devices_failed + exportResults.devices_failed,
          }
          break
        
        default:
          return new Response(
            JSON.stringify({ error: 'Invalid operation' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
      }

      const duration = Date.now() - startTime

      // Log activity completion
      if (logId) {
        await logActivityComplete(supabase, logId, {
          status: results.devices_failed > 0 ? 'failed' : 'success',
          responseTimeMs: duration,
          responseBody: {
            devices_processed: results.devices_processed,
            devices_succeeded: results.devices_succeeded,
            devices_failed: results.devices_failed,
          },
          errorMessage: results.errors && results.errors.length > 0 ? results.errors.join('; ') : undefined,
        })
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (syncError) {
      const duration = Date.now() - startTime
      
      // Log failure
      if (logId) {
        await logActivityComplete(supabase, logId, {
          status: 'error',
          responseTimeMs: duration,
          errorMessage: syncError instanceof Error ? syncError.message : 'Sync operation failed',
        })
      }
      
      throw syncError
    }

  } catch (error) {
    console.error('Azure IoT Hub sync error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
