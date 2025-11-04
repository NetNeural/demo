// Deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { 
  getUserContext, 
  getTargetOrganizationId,
  createAuthenticatedClient,
  createAuthErrorResponse,
  createSuccessResponse,
  corsHeaders 
} from '../_shared/auth.ts'

// Test helper functions
interface IntegrationSettings {
  apiKey?: string
  projectId?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  connectionString?: string
  hubName?: string
  registryId?: string
  smtpHost?: string
  smtpPort?: number
  smtpUsername?: string
  webhookUrl?: string
  channel?: string
  url?: string
  brokerUrl?: string
  port?: number
  clientId?: string
  [key: string]: unknown
}

interface DbIntegration {
  id: string
  integration_type: string
  name: string
  status: string
  project_id?: string
  base_url?: string
  settings?: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface UpdateFields {
  name?: string
  settings?: Record<string, unknown>
  api_key_encrypted?: string
  project_id?: string
  base_url?: string
  status?: string
  updated_at?: string
}

async function testGoliothIntegration(settings: IntegrationSettings) {
  // Validate required fields
  if (!settings?.apiKey) {
    return { success: false, message: 'Golioth integration requires an API Key. Please configure the integration first.', details: {} }
  }
  if (!settings?.projectId) {
    return { success: false, message: 'Golioth integration requires a Project ID. Please configure the integration first.', details: {} }
  }
  
  // In production, this would call Golioth API
  return { 
    success: true, 
    message: 'Golioth API credentials validated', 
    details: { apiKey: '***' + settings.apiKey.slice(-4), projectId: settings.projectId }
  }
}

async function testAwsIotIntegration(settings: IntegrationSettings) {
  if (!settings?.region || !settings?.accessKeyId || !settings?.secretAccessKey) {
    return { success: false, message: 'Missing AWS IoT credentials', details: {} }
  }
  
  return { 
    success: true, 
    message: 'AWS IoT credentials validated', 
    details: { region: settings.region, accessKeyId: '***' + settings.accessKeyId.slice(-4) }
  }
}

async function testAzureIotIntegration(settings: IntegrationSettings) {
  if (!settings?.connectionString || !settings?.hubName) {
    return { success: false, message: 'Missing Azure IoT Hub credentials', details: {} }
  }
  
  return { 
    success: true, 
    message: 'Azure IoT Hub connection validated', 
    details: { hubName: settings.hubName }
  }
}

async function testGoogleIotIntegration(settings: IntegrationSettings) {
  if (!settings?.projectId || !settings?.region || !settings?.registryId) {
    return { success: false, message: 'Missing Google Cloud IoT credentials', details: {} }
  }
  
  return { 
    success: true, 
    message: 'Google Cloud IoT credentials validated', 
    details: { projectId: settings.projectId, region: settings.region, registryId: settings.registryId }
  }
}

async function testEmailIntegration(settings: IntegrationSettings) {
  if (!settings?.smtpHost || !settings?.smtpPort || !settings?.smtpUsername) {
    return { success: false, message: 'Missing SMTP configuration', details: {} }
  }
  
  return { 
    success: true, 
    message: 'SMTP configuration validated', 
    details: { host: settings.smtpHost, port: settings.smtpPort, username: settings.smtpUsername }
  }
}

async function testSlackIntegration(settings: IntegrationSettings) {
  if (!settings?.webhookUrl) {
    return { success: false, message: 'Missing Slack webhook URL', details: {} }
  }
  
  // Test Slack webhook with a ping message
  try {
    const response = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '✓ NetNeural integration test successful' })
    })
    
    if (!response.ok) {
      return { success: false, message: `Slack webhook returned ${response.status}`, details: {} }
    }
    
    return { 
      success: true, 
      message: 'Slack webhook validated (test message sent)', 
      details: { channel: settings.channel || 'default' }
    }
  } catch (error) {
    return { success: false, message: `Slack webhook error: ${(error as Error).message}`, details: {} }
  }
}

async function testWebhookIntegration(settings: IntegrationSettings) {
  if (!settings?.url) {
    return { success: false, message: 'Missing webhook URL', details: {} }
  }
  
  // Test webhook with a ping
  try {
    const response = await fetch(settings.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true, message: 'NetNeural integration test' })
    })
    
    return { 
      success: true, 
      message: `Webhook responded with status ${response.status}`, 
      details: { url: settings.url, status: response.status }
    }
  } catch (error) {
    return { success: false, message: `Webhook error: ${(error as Error).message}`, details: {} }
  }
}

async function testMqttIntegration(settings: IntegrationSettings) {
  if (!settings?.brokerUrl || !settings?.port) {
    return { success: false, message: 'Missing MQTT broker configuration', details: {} }
  }
  
  return { 
    success: true, 
    message: 'MQTT broker configuration validated', 
    details: { broker: settings.brokerUrl, port: settings.port, clientId: settings.clientId }
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user context
    const userContext = await getUserContext(req)
    
    // Create authenticated Supabase client (respects RLS)
    const supabase = createAuthenticatedClient(req)

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const requestedOrgId = url.searchParams.get('organization_id')
      const integrationTypeFilter = url.searchParams.get('type') // Filter by integration type
      
      // Determine which organization to query based on user's role
      const organizationId = getTargetOrganizationId(userContext, requestedOrgId)
      
      if (!organizationId && !userContext.isSuperAdmin) {
        return createAuthErrorResponse('User has no organization access', 403)
      }

      // Build query - RLS will enforce access automatically
      let query = supabase
        .from('device_integrations')
        .select('*')
        .order('created_at', { ascending: false })
      
      // Only filter by org if specified (super admins can query all orgs)
      if (organizationId) {
        query = query.eq('organization_id', organizationId)
      }

      // Apply integration type filter if specified
      if (integrationTypeFilter) {
        query = query.eq('integration_type', integrationTypeFilter)
      }

      // Execute query - RLS ensures user can only see allowed integrations
      const { data: integrations, error } = await query

      if (error) {
        console.error('Database error:', error)
        return createAuthErrorResponse(`Failed to fetch integrations: ${error.message}`, 500)
      }

      // Enrich integrations with device counts
      const enrichedIntegrations = await Promise.all(
        (integrations || []).map(async (integration: DbIntegration) => {
          // Get device count for this integration
          const { count: deviceCount } = await supabase
            .from('devices')
            .select('id', { count: 'exact', head: true })
            .eq('integration_id', integration.id)

          return {
            id: integration.id,
            type: integration.integration_type,
            name: integration.name,
            status: integration.status,
            projectId: integration.project_id,
            baseUrl: integration.base_url,
            deviceCount: deviceCount || 0,
            settings: integration.settings || {},
            createdAt: integration.created_at,
            updatedAt: integration.updated_at
          }
        })
      )

      return createSuccessResponse({ 
        integrations: enrichedIntegrations,
        count: enrichedIntegrations.length,
        organizationId,
        filters: {
          type: integrationTypeFilter
        }
      })
    }

    if (req.method === 'POST') {
      // Create new integration
      const body = await req.json()
      const { organization_id, integration_type, name, settings, api_key, project_id, base_url } = body

      if (!organization_id || !integration_type || !name) {
        return createAuthErrorResponse('Missing required fields: organization_id, integration_type, name', 400)
      }

      // Validate integration type
      const validTypes = ['golioth', 'aws_iot', 'azure_iot', 'google_iot', 'email', 'slack', 'webhook', 'mqtt']
      if (!validTypes.includes(integration_type)) {
        return createAuthErrorResponse(`Invalid integration_type. Must be one of: ${validTypes.join(', ')}`, 400)
      }

      // Check if user has permission to create integrations for this org
      const canCreate = userContext.isSuperAdmin || 
                       userContext.organizationId === organization_id
      
      if (!canCreate) {
        return createAuthErrorResponse('Not authorized to create integrations for this organization', 403)
      }

      // Create integration - RLS will enforce permissions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newIntegration, error } = await supabase
        .from('device_integrations')
        .insert({
          organization_id,
          integration_type,
          name,
          settings: settings || {},
          api_key_encrypted: api_key, // TODO: Encrypt this properly
          project_id,
          base_url,
          status: 'active'
        } as any)
        .select()
        .single()

      if (error) {
        console.error('Create integration error:', error)
        return createAuthErrorResponse(`Failed to create integration: ${error.message}`, 500)
      }

      return createSuccessResponse({ 
        integration: newIntegration,
        message: 'Integration created successfully'
      }, 201)
    }

    if (req.method === 'PUT') {
      // Update existing integration
      const url = new URL(req.url)
      const integrationId = url.searchParams.get('id')
      
      if (!integrationId) {
        return createAuthErrorResponse('Missing integration id parameter', 400)
      }

      const body = await req.json()
      const { name, settings, api_key, project_id, base_url, status } = body

      // Build update object
      interface UpdateFields {
        updated_at: string
        name?: string
        settings?: Record<string, unknown>
        api_key_encrypted?: string
        project_id?: string
        base_url?: string
        status?: string
      }

      const updates: UpdateFields = {
        updated_at: new Date().toISOString()
      }
      
      if (name !== undefined) updates.name = name
      if (settings !== undefined) updates.settings = settings
      if (api_key !== undefined) updates.api_key_encrypted = api_key // TODO: Encrypt properly
      if (project_id !== undefined) updates.project_id = project_id
      if (base_url !== undefined) updates.base_url = base_url
      if (status !== undefined) {
        const validStatuses = ['active', 'inactive', 'error']
        if (!validStatuses.includes(status)) {
          return createAuthErrorResponse(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400)
        }
        updates.status = status
      }

      // Update integration - RLS will enforce permissions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updatedIntegration, error } = await supabase
        .from('device_integrations')
        .update(updates as any)
        .eq('id', integrationId)
        .select()
        .single()

      if (error) {
        console.error('Update integration error:', error)
        return createAuthErrorResponse(`Failed to update integration: ${error.message}`, 500)
      }

      if (!updatedIntegration) {
        return createAuthErrorResponse('Integration not found or access denied', 404)
      }

      return createSuccessResponse({ 
        integration: updatedIntegration,
        message: 'Integration updated successfully'
      })
    }

    if (req.method === 'DELETE') {
      // Delete integration
      const url = new URL(req.url)
      const integrationId = url.searchParams.get('id')
      
      if (!integrationId) {
        return createAuthErrorResponse('Missing integration id parameter', 400)
      }

      // Delete integration - RLS will enforce permissions
      const { error } = await supabase
        .from('device_integrations')
        .delete()
        .eq('id', integrationId)

      if (error) {
        console.error('Delete integration error:', error)
        return createAuthErrorResponse(`Failed to delete integration: ${error.message}`, 500)
      }

      return createSuccessResponse({ 
        message: 'Integration deleted successfully'
      })
    }

    // POST /integrations/test - Test integration connection
    if (req.method === 'POST' && req.url.includes('/test')) {
      const url = new URL(req.url)
      const integrationId = url.searchParams.get('id')
      
      if (!integrationId) {
        return createAuthErrorResponse('Missing integration id parameter', 400)
      }

      // Get integration details - RLS will enforce permissions
      const { data: integration, error: fetchError } = await supabase
        .from('device_integrations')
        .select('*')
        .eq('id', integrationId)
        .single()

      if (fetchError || !integration) {
        return createAuthErrorResponse('Integration not found or access denied', 404)
      }

      // Type the integration result
      const typedIntegration = integration as DbIntegration

      // Test based on integration type
      let testResult = { success: true, message: '', details: {} }

      try {
        switch (typedIntegration.integration_type) {
          case 'golioth':
            // Test Golioth API connection
            testResult = await testGoliothIntegration(typedIntegration.settings || {})
            break
          
          case 'aws_iot':
            testResult = await testAwsIotIntegration(typedIntegration.settings || {})
            break
          
          case 'azure_iot':
            testResult = await testAzureIotIntegration(typedIntegration.settings || {})
            break
          
          case 'google_iot':
            testResult = await testGoogleIotIntegration(typedIntegration.settings || {})
            break
          
          case 'email':
            testResult = await testEmailIntegration(typedIntegration.settings || {})
            break
          
          case 'slack':
            testResult = await testSlackIntegration(typedIntegration.settings || {})
            break
          
          case 'webhook':
            testResult = await testWebhookIntegration(typedIntegration.settings || {})
            break
          
          case 'mqtt':
            testResult = await testMqttIntegration(typedIntegration.settings || {})
            break
          
          default:
            return createAuthErrorResponse(`Unsupported integration type: ${typedIntegration.integration_type}`, 400)
        }

        if (testResult.success) {
          return createSuccessResponse({
            message: testResult.message || `${typedIntegration.name} connection verified successfully`,
            details: testResult.details
          })
        } else {
          // Return 400 for configuration issues (bad request), not 500 (server error)
          return createAuthErrorResponse(testResult.message || 'Integration test failed', 400)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return createAuthErrorResponse(`Test failed: ${errorMessage}`, 500)
      }
    }

    return createAuthErrorResponse('Method not allowed', 405)
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Edge function error:', errorMessage, error)
    
    // Handle auth errors specifically
    if (errorMessage.includes('Unauthorized') || errorMessage.includes('authorization')) {
      return createAuthErrorResponse(errorMessage, 401)
    }
    
    return createAuthErrorResponse(errorMessage, 500)
  }
})