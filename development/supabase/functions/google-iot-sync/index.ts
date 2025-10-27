// ============================================================================
// GOOGLE CLOUD IOT SYNC EDGE FUNCTION
// ============================================================================
// Handles bidirectional sync between NetNeural and Google Cloud IoT Core
// Supports device registry, telemetry, and device configuration
//
// Version: 1.0.0
// Date: 2025-10-27
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GoogleIotConfig {
  project_id: string
  region: string
  registry_id: string
  service_account_key: string // JSON string
}

interface SyncOperation {
  organization_id: string
  integration_id: string
  operation: 'import' | 'export' | 'bidirectional'
  device_ids?: string[]
}

interface GoogleDevice {
  id: string
  name: string
  numId: string
  credentials: Array<{
    publicKey: { format: string; key: string }
    expirationTime: string
  }>
  lastHeartbeatTime: string
  lastEventTime: string
  lastStateTime: string
  lastConfigAckTime: string
  lastConfigSendTime: string
  blocked: boolean
  lastErrorTime: string
  lastErrorStatus: { code: number; message: string }
  config: {
    version: string
    cloudUpdateTime: string
    deviceAckTime: string
    binaryData: string
  }
  state: {
    updateTime: string
    binaryData: string
  }
  logLevel: 'NONE' | 'ERROR' | 'INFO' | 'DEBUG'
  metadata: Record<string, string>
}

async function getGoogleAccessToken(serviceAccountKey: string): Promise<string> {
  // Parse service account JSON
  const serviceAccount = JSON.parse(serviceAccountKey)
  
  // Create JWT for Google OAuth2
  const now = Math.floor(Date.now() / 1000)
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }
  
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }
  
  // Note: This is simplified - in production, use proper JWT signing
  // For now, we'll use a placeholder approach
  // You would need to implement RSA signing with the private_key from service account
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: 'placeholder-jwt', // Replace with actual signed JWT
    }),
  })
  
  if (!tokenResponse.ok) {
    throw new Error('Failed to get Google access token')
  }
  
  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

async function makeGoogleRequest(
  endpoint: string,
  method: string,
  accessToken: string,
  body?: string
) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
  
  const response = await fetch(endpoint, {
    method,
    headers,
    body,
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Google Cloud IoT API error (${response.status}): ${errorText}`)
  }
  
  return await response.json()
}

async function importFromGoogle(
  config: GoogleIotConfig,
  accessToken: string,
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
    // List all devices from Google Cloud IoT registry
    const registryPath = `projects/${config.project_id}/locations/${config.region}/registries/${config.registry_id}`
    const endpoint = `https://cloudiot.googleapis.com/v1/${registryPath}/devices`
    
    const response = await makeGoogleRequest(endpoint, 'GET', accessToken)
    const devices: GoogleDevice[] = response.devices || []
    
    for (const device of devices) {
      results.devices_processed++
      
      try {
        // Determine device status
        const isOnline = device.lastHeartbeatTime && 
          new Date(device.lastHeartbeatTime).getTime() > Date.now() - 5 * 60 * 1000 // 5 minutes
        
        // Upsert device in NetNeural
        const { error } = await supabase
          .from('devices')
          .upsert({
            organization_id: organizationId,
            integration_id: integrationId,
            external_device_id: device.id,
            name: device.name || device.id,
            device_type: device.metadata?.deviceType || 'unknown',
            status: device.blocked ? 'disabled' : (isOnline ? 'online' : 'offline'),
            last_seen: device.lastHeartbeatTime ? new Date(device.lastHeartbeatTime) : null,
            metadata: {
              google_num_id: device.numId,
              google_log_level: device.logLevel,
              google_metadata: device.metadata,
              google_last_event: device.lastEventTime,
              google_last_state: device.lastStateTime,
              google_config_version: device.config?.version,
              google_blocked: device.blocked,
            },
          }, {
            onConflict: 'organization_id,external_device_id',
          })
        
        if (error) {
          results.devices_failed++
          results.errors.push(`${device.id}: ${error.message}`)
        } else {
          results.devices_succeeded++
        }
      } catch (error) {
        results.devices_failed++
        results.errors.push(`${device.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  } catch (error) {
    throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  return results
}

async function exportToGoogle(
  config: GoogleIotConfig,
  accessToken: string,
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
    
    const registryPath = `projects/${config.project_id}/locations/${config.region}/registries/${config.registry_id}`
    
    for (const device of devices || []) {
      results.devices_processed++
      
      try {
        const deviceId = device.external_device_id || device.id
        const devicePath = `${registryPath}/devices/${deviceId}`
        
        // Create/update device in Google Cloud IoT
        const deviceBody = JSON.stringify({
          id: deviceId,
          name: `${registryPath}/devices/${deviceId}`,
          blocked: device.status === 'disabled',
          logLevel: 'INFO',
          metadata: {
            deviceType: device.device_type,
            model: device.model || '',
            serialNumber: device.serial_number || '',
            firmwareVersion: device.firmware_version || '',
          },
        })
        
        // Try to create device (will fail if exists)
        try {
          await makeGoogleRequest(
            `https://cloudiot.googleapis.com/v1/${registryPath}/devices`,
            'POST',
            accessToken,
            deviceBody
          )
        } catch (e) {
          // Device might already exist, try to update instead
          await makeGoogleRequest(
            `https://cloudiot.googleapis.com/v1/${devicePath}?updateMask=blocked,logLevel,metadata`,
            'PATCH',
            accessToken,
            deviceBody
          )
        }
        
        // Send configuration update to device
        const configBody = JSON.stringify({
          versionToUpdate: '0',
          binaryData: btoa(JSON.stringify({
            status: device.status,
            battery_level: device.battery_level,
            signal_strength: device.signal_strength,
            last_sync: new Date().toISOString(),
          })),
        })
        
        await makeGoogleRequest(
          `https://cloudiot.googleapis.com/v1/${devicePath}:modifyCloudToDeviceConfig`,
          'POST',
          accessToken,
          configBody
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

    // Get Google Cloud IoT integration config
    const { data: integration, error: intError } = await supabase
      .from('device_integrations')
      .select('*')
      .eq('id', integration_id)
      .eq('integration_type', 'google_iot')
      .single()

    if (intError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Google Cloud IoT integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const googleConfig: GoogleIotConfig = JSON.parse(integration.api_key_encrypted || '{}')
    const accessToken = await getGoogleAccessToken(googleConfig.service_account_key)

    let results
    const startTime = Date.now()

    switch (operation) {
      case 'import':
        results = await importFromGoogle(googleConfig, accessToken, supabase, organization_id, integration_id)
        break
      
      case 'export':
        results = await exportToGoogle(googleConfig, accessToken, supabase, organization_id, integration_id, device_ids)
        break
      
      case 'bidirectional':
        const importResults = await importFromGoogle(googleConfig, accessToken, supabase, organization_id, integration_id)
        const exportResults = await exportToGoogle(googleConfig, accessToken, supabase, organization_id, integration_id, device_ids)
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

    // Log sync operation
    await supabase.from('golioth_sync_log').insert({
      organization_id,
      integration_id,
      operation,
      status: results.devices_failed > 0 ? 'partial' : 'completed',
      devices_processed: results.devices_processed,
      devices_succeeded: results.devices_succeeded,
      devices_failed: results.devices_failed,
      error_message: results.errors && results.errors.length > 0 ? results.errors.join('; ') : null,
      duration_ms: duration,
      completed_at: new Date().toISOString(),
    })

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Google Cloud IoT sync error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
