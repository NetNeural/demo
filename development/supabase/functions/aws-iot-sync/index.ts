// ============================================================================
// AWS IOT SYNC EDGE FUNCTION
// ============================================================================
// Handles bidirectional sync between NetNeural and AWS IoT Core
// Supports device shadows, fleet management, and device lifecycle
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

interface AwsIotConfig {
  region: string
  access_key_id: string
  secret_access_key: string
  endpoint?: string
}

interface SyncOperation {
  organization_id: string
  integration_id: string
  operation: 'import' | 'export' | 'bidirectional'
  device_ids?: string[]
}

async function getAwsIotClient(config: AwsIotConfig) {
  // AWS SDK for Deno
  // Using AWS IoT Data Plane API
  const endpoint = config.endpoint || `https://iot.${config.region}.amazonaws.com`
  
  return {
    endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.access_key_id,
      secretAccessKey: config.secret_access_key,
    }
  }
}

async function signAwsRequest(
  method: string,
  url: string,
  body: string | null,
  credentials: { accessKeyId: string; secretAccessKey: string },
  region: string,
  service: string = 'iotdata'
) {
  // Simplified AWS Signature V4 implementation
  // In production, use a proper AWS SDK
  
  const date = new Date()
  const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '')
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  
  const headers: Record<string, string> = {
    'Host': new URL(url).host,
    'X-Amz-Date': amzDate,
    'Content-Type': 'application/json',
  }
  
  // This is a placeholder - in production, implement full AWS Signature V4
  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`
  
  return headers
}

async function importFromAws(client: Awaited<ReturnType<typeof getAwsIotClient>>, supabase: ReturnType<typeof createClient>, organizationId: string, integrationId: string) {
  const results = {
    devices_processed: 0,
    devices_succeeded: 0,
    devices_failed: 0,
    errors: [] as string[],
  }
  
  try {
    // List things (devices) from AWS IoT
    const listUrl = `${client.endpoint}/things`
    const headers = await signAwsRequest('GET', listUrl, null, client.credentials, client.region)
    
    const response = await fetch(listUrl, { method: 'GET', headers })
    
    if (!response.ok) {
      throw new Error(`AWS IoT API error: ${response.statusText}`)
    }
    
    const { things } = await response.json()
    
    for (const thing of things || []) {
      results.devices_processed++
      
      try {
        // Get thing shadow for detailed state
        const shadowUrl = `${client.endpoint}/things/${thing.thingName}/shadow`
        const shadowHeaders = await signAwsRequest('GET', shadowUrl, null, client.credentials, client.region)
        const shadowResponse = await fetch(shadowUrl, { method: 'GET', headers: shadowHeaders })
        
        let shadowData = {}
        if (shadowResponse.ok) {
          shadowData = await shadowResponse.json()
        }
        
        // Upsert device in NetNeural
        const { error } = await supabase
          .from('devices')
          .upsert({
            organization_id: organizationId,
            integration_id: integrationId,
            external_device_id: thing.thingName,
            name: thing.thingName,
            device_type: thing.thingTypeName || 'unknown',
            status: thing.connectivity?.connected ? 'online' : 'offline',
            last_seen: thing.connectivity?.timestamp ? new Date(thing.connectivity.timestamp) : null,
            metadata: {
              aws_thing_arn: thing.thingArn,
              aws_attributes: thing.attributes,
              aws_shadow: shadowData,
            },
          }, {
            onConflict: 'organization_id,external_device_id',
          })
        
        if (error) {
          results.devices_failed++
          results.errors.push(`${thing.thingName}: ${error.message}`)
        } else {
          results.devices_succeeded++
        }
      } catch (error) {
        results.devices_failed++
        results.errors.push(`${thing.thingName}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  } catch (error) {
    throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  return results
}

async function exportToAws(client: Awaited<ReturnType<typeof getAwsIotClient>>, supabase: ReturnType<typeof createClient>, organizationId: string, integrationId: string, deviceIds?: string[]) {
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
        const thingName = device.external_device_id || device.id
        
        // Create/update thing in AWS IoT
        const createUrl = `${client.endpoint}/things/${thingName}`
        const body = JSON.stringify({
          thingName,
          thingTypeName: device.device_type,
          attributePayload: {
            attributes: {
              serial_number: device.serial_number || '',
              model: device.model || '',
              firmware_version: device.firmware_version || '',
            },
          },
        })
        
        const headers = await signAwsRequest('PUT', createUrl, body, client.credentials, client.region)
        
        const response = await fetch(createUrl, {
          method: 'PUT',
          headers,
          body,
        })
        
        if (!response.ok && response.status !== 409) { // 409 = already exists
          throw new Error(`AWS IoT API error: ${response.statusText}`)
        }
        
        // Update device shadow with current state
        const shadowUrl = `${client.endpoint}/things/${thingName}/shadow`
        const shadowBody = JSON.stringify({
          state: {
            reported: {
              status: device.status,
              battery_level: device.battery_level,
              signal_strength: device.signal_strength,
              last_seen: device.last_seen,
            },
          },
        })
        
        const shadowHeaders = await signAwsRequest('POST', shadowUrl, shadowBody, client.credentials, client.region)
        
        await fetch(shadowUrl, {
          method: 'POST',
          headers: shadowHeaders,
          body: shadowBody,
        })
        
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

    // Get AWS IoT integration config
    const { data: integration, error: intError } = await supabase
      .from('device_integrations')
      .select('*')
      .eq('id', integration_id)
      .eq('integration_type', 'aws_iot')
      .single()

    if (intError || !integration) {
      return new Response(
        JSON.stringify({ error: 'AWS IoT integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const config: AwsIotConfig = JSON.parse(integration.api_key_encrypted || '{}')
    const client = await getAwsIotClient(config)

    let results
    const startTime = Date.now()

    switch (operation) {
      case 'import':
        results = await importFromAws(client, supabase, organization_id, integration_id)
        break
      
      case 'export':
        results = await exportToAws(client, supabase, organization_id, integration_id, device_ids)
        break
      
      case 'bidirectional':
        const importResults = await importFromAws(client, supabase, organization_id, integration_id)
        const exportResults = await exportToAws(client, supabase, organization_id, integration_id, device_ids)
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
      error_message: results.errors?.length > 0 ? results.errors.join('; ') : null,
      duration_ms: duration,
      completed_at: new Date().toISOString(),
    })

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('AWS IoT sync error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
