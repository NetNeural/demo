import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logActivityStart, logActivityComplete, getIpAddress } from '../_shared/activity-logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const integrationId = url.pathname.split('/').pop()

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      supabaseClient.auth.setAuth(authHeader.replace('Bearer ', ''))
    }

    if (req.method === 'POST') {
      const startTime = Date.now()
      
      const { data: integration, error } = await supabaseClient
        .from('device_integrations')
        .select(`
          *,
          organization:organizations(id, name, slug)
        `)
        .eq('id', integrationId)
        .single()

      if (error || !integration) {
        return new Response(
          JSON.stringify({ error: 'Integration not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
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

      let testResult
      switch (integration.integration_type) {
        case 'golioth':
          testResult = await testGoliothConnection(integration, supabaseClient, logId)
          break
        case 'azure_iot':
          testResult = await testAzureIoTConnection(integration)
          break
        case 'aws_iot':
          testResult = await testAWSIoTConnection(integration)
          break
        default:
          testResult = {
            success: false,
            message: `Integration type ${integration.integration_type} is not supported for testing`,
            details: {}
          }
      }

      // Log test activity completion
      if (logId) {
        const responseTime = Date.now() - startTime
        await logActivityComplete(supabaseClient, logId, {
          status: testResult.success ? 'success' : 'failed',
          responseTimeMs: responseTime,
          responseBody: testResult,
          errorMessage: testResult.success ? undefined : testResult.message,
        })
      }

      return new Response(
        JSON.stringify(testResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function testGoliothConnection(integration: any, supabaseClient: any, activityLogId: string | null) {
  const startTime = Date.now()
  
  try {
    const apiKey = integration.api_key_encrypted
    const projectId = integration.project_id
    const baseUrl = integration.base_url || 'https://api.golioth.io'

    if (!apiKey || !projectId) {
      return {
        success: false,
        message: 'Missing required Golioth configuration (API key or project ID)',
        details: { hasApiKey: !!apiKey, hasProjectId: !!projectId }
      }
    }

    const endpoint = `${baseUrl}/v1/projects/${projectId}`
    
    // Log Golioth API call
    const goliothLogId = await logActivityStart(supabaseClient, {
      organizationId: integration.organization_id,
      integrationId: integration.id,
      direction: 'outgoing',
      activityType: 'api_call',
      method: 'GET',
      endpoint: endpoint,
      metadata: {
        purpose: 'connection_test',
      },
    })

    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    const responseTime = Date.now() - startTime

    if (response.ok) {
      const data = await response.json()
      
      // Log successful API call
      if (goliothLogId) {
        await logActivityComplete(supabaseClient, goliothLogId, {
          status: 'success',
          responseStatus: response.status,
          responseTimeMs: responseTime,
          responseBody: { projectName: data.name },
        })
      }
      
      return {
        success: true,
        message: 'Successfully connected to Golioth API',
        details: {
          projectName: data.name,
          status: response.status,
          responseTime: responseTime
        }
      }
    } else {
      // Log failed API call
      if (goliothLogId) {
        await logActivityComplete(supabaseClient, goliothLogId, {
          status: 'failed',
          responseStatus: response.status,
          responseTimeMs: responseTime,
          errorMessage: `${response.status} ${response.statusText}`,
        })
      }
      
      return {
        success: false,
        message: `Golioth API error: ${response.status} ${response.statusText}`,
        details: { status: response.status, statusText: response.statusText }
      }
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to connect to Golioth API',
      details: { error: error.message }
    }
  }
}

async function testAzureIoTConnection(integration: any) {
  return {
    success: false,
    message: 'Azure IoT Hub testing not implemented yet',
    details: {}
  }
}

async function testAWSIoTConnection(integration: any) {
  return {
    success: false,
    message: 'AWS IoT Core testing not implemented yet',
    details: {}
  }
}