import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logActivityStart, logActivityComplete } from '../_shared/activity-logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { integrationId, organizationId, operation, deviceIds } = await req.json()

    if (!integrationId || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: integrationId, organizationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: integration, error: integrationError } = await supabase
      .from('device_integrations')
      .select('*')
      .eq('id', integrationId)
      .single()

    if (integrationError || !integration) {
      console.error('[device-sync] Integration not found:', integrationError)
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Test connection by validating Golioth API credentials
    if (operation === 'test' || !deviceIds || deviceIds.length === 0) {
      console.log('[device-sync] Testing Golioth API connection...')
      const testStartTime = Date.now()
      
      // Build the actual URL that was tested
      let baseUrl = (integration.base_url || 'https://api.golioth.io').replace(/\/$/, '')
      if (!baseUrl.includes('/v1')) {
        baseUrl = baseUrl + '/v1'
      }
      const endpoint = `${baseUrl}/projects/${integration.project_id}`
      
      // Start activity logging
      const logId = await logActivityStart(supabase, {
        organizationId,
        integrationId,
        direction: 'outgoing',
        activityType: 'test_connection',
        method: 'GET',
        endpoint,
        metadata: {
          integration_name: integration.name,
          project_id: integration.project_id,
        }
      })
      
      const testResult = await testGoliothConnection(integration)
      const testDuration = Date.now() - testStartTime
      
      if (!testResult.success) {
        console.error('[device-sync] Golioth API test failed:', testResult.error)
        
        // Log failure
        if (logId) {
          await logActivityComplete(supabase, logId, {
            status: 'failed',
            responseStatus: testResult.statusCode,
            responseTimeMs: testDuration,
            errorMessage: testResult.error,
            responseBody: testResult.apiResponse,
          })
        }
        
        // Return 200 with success:false so Supabase client can read the error details
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: testResult.error,
            message: 'Failed to connect to Golioth API' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log('[device-sync] Golioth API test successful')
      
      // Log success
      if (logId) {
        await logActivityComplete(supabase, logId, {
          status: 'success',
          responseStatus: testResult.statusCode,
          responseTimeMs: testDuration,
          responseBody: testResult.apiResponse,
        })
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Successfully connected to Golioth API',
          projectId: testResult.projectId
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result
    switch (operation) {
      case 'import':
        result = await performImport(supabase, integration, deviceIds)
        break
      case 'export':
        result = await performExport(supabase, integration, deviceIds)
        break
      case 'bidirectional':
        result = await performBidirectional(supabase, integration, deviceIds)
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid operation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    console.log(`[device-sync] ${operation} completed:`, result)
    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[device-sync] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function performImport(supabase: any, integration: any, deviceIds: string[]) {
  console.log('[device-sync] Performing import for', deviceIds.length, 'devices')
  return { imported: deviceIds.length, message: 'Import functionality coming soon' }
}

async function performExport(supabase: any, integration: any, deviceIds: string[]) {
  console.log('[device-sync] Performing export for', deviceIds.length, 'devices')
  return { exported: deviceIds.length, message: 'Export functionality coming soon' }
}

async function performBidirectional(supabase: any, integration: any, deviceIds: string[]) {
  console.log('[device-sync] Performing bidirectional sync for', deviceIds.length, 'devices')
  return { synced: deviceIds.length, message: 'Bidirectional sync functionality coming soon' }
}

async function testGoliothConnection(integration: any): Promise<{ 
  success: boolean; 
  error?: string; 
  projectId?: string;
  apiResponse?: any;
  statusCode?: number;
}> {
  try {
    // Extract credentials from integration record
    const apiKey = integration.api_key_encrypted || integration.config?.apiKey
    const projectId = integration.project_id || integration.config?.projectId
    const baseUrl = integration.base_url || integration.config?.apiUrl || 'https://api.golioth.io'
    
    if (!apiKey || !projectId) {
      console.error('[device-sync] Missing credentials:', { hasApiKey: !!apiKey, hasProjectId: !!projectId })
      return { 
        success: false, 
        error: 'Missing API key or Project ID in integration configuration',
        statusCode: 400
      }
    }

    // Log API key info (masked for security)
    const keyPrefix = apiKey.substring(0, 8)
    const keyLength = apiKey.length
    console.log(`[device-sync] Using API key: ${keyPrefix}... (length: ${keyLength})`)

    // Ensure base URL doesn't have trailing slash and has /v1
    let apiUrl = baseUrl.replace(/\/$/, '')
    if (!apiUrl.includes('/v1')) {
      apiUrl = apiUrl + '/v1'
    }
    
    const projectsUrl = `${apiUrl}/projects/${projectId}`
    
    console.log(`[device-sync] Testing connection to Golioth project: ${projectId}`)
    console.log(`[device-sync] API URL: ${projectsUrl}`)
    
    // Make a simple API call to verify credentials
    const response = await fetch(projectsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      let apiResponse
      try {
        apiResponse = JSON.parse(errorText)
      } catch {
        apiResponse = errorText
      }
      
      console.error(`[device-sync] Golioth API error (${response.status}):`, errorText)
      
      if (response.status === 401) {
        return { 
          success: false, 
          error: 'Invalid API key - authentication failed',
          apiResponse,
          statusCode: response.status
        }
      } else if (response.status === 403) {
        return { 
          success: false, 
          error: `Access denied - The API key does not have permission to access project '${projectId}'. Verify: 1) The project ID is correct, 2) The API key belongs to this project, 3) The API key has read permissions`,
          apiResponse,
          statusCode: response.status
        }
      } else if (response.status === 404) {
        return { 
          success: false, 
          error: `Project not found: ${projectId}`,
          apiResponse,
          statusCode: response.status
        }
      } else {
        return { 
          success: false, 
          error: `API error: ${response.status} ${response.statusText}`,
          apiResponse,
          statusCode: response.status
        }
      }
    }

    const projectData = await response.json()
    console.log('[device-sync] Successfully connected to Golioth project:', projectData.name || projectId)
    
    return { 
      success: true, 
      projectId: projectId,
      apiResponse: projectData,
      statusCode: response.status
    }
  } catch (error) {
    console.error('[device-sync] Connection test exception:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      statusCode: 500
    }
  }
}
