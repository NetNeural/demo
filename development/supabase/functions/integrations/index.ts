// Deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { 
  getUserContext, 
  getTargetOrganizationId,
  createAuthenticatedClient,
  createAuthErrorResponse,
  createSuccessResponse,
  corsHeaders 
} from '../_shared/auth.ts'
import { logActivity, getIpAddress, sanitizeHeaders } from '../_shared/activity-logger.ts'
import { GoliothClient } from '../_shared/golioth-client.ts'
import { AwsIotClient } from '../_shared/aws-iot-client.ts'
import { AzureIotClient } from '../_shared/azure-iot-client.ts'
import { GoogleIotClient } from '../_shared/google-iot-client.ts'
import { MqttClient } from '../_shared/mqtt-client.ts'
import type { BaseIntegrationClient } from '../_shared/base-integration-client.ts'

type SupabaseClient = ReturnType<typeof createClient>

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
  organization_id: string
  integration_type: string
  name: string
  status: string
  project_id?: string
  base_url?: string
  settings?: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ===========================================================================
// Unified Integration Test Function
// ===========================================================================
// Uses the new BaseIntegrationClient pattern for all integrations
// ===========================================================================

async function testIntegrationUnified(
  supabase: SupabaseClient,
  integrationType: string,
  settings: IntegrationSettings,
  organizationId: string,
  integrationId: string
): Promise<{ success: boolean; message: string; details: Record<string, unknown> }> {
  try {
    let client: BaseIntegrationClient

    // Map integration type to client class
    switch (integrationType) {
      case 'golioth':
        client = new GoliothClient({
          type: 'golioth',
          settings: {
            apiKey: settings.apiKey,
            projectId: settings.projectId,
            baseUrl: settings.baseUrl as string | undefined,
          },
          organizationId,
          integrationId,
          supabase,
        })
        break

      case 'aws_iot':
        client = new AwsIotClient({
          type: 'aws-iot',
          settings: {
            region: settings.region,
            accessKeyId: settings.accessKeyId,
            secretAccessKey: settings.secretAccessKey,
            endpoint: settings.endpoint as string | undefined,
          },
          organizationId,
          integrationId,
          supabase,
        })
        break

      case 'azure_iot':
        client = new AzureIotClient({
          type: 'azure-iot',
          settings: {
            connectionString: settings.connectionString,
            hubName: settings.hubName,
          },
          organizationId,
          integrationId,
          supabase,
        })
        break

      case 'google_iot':
        client = new GoogleIotClient({
          type: 'google-iot',
          settings: {
            projectId: settings.projectId,
            region: settings.region,
            registryId: settings.registryId,
            serviceAccountKey: settings.serviceAccountKey as string || '',
          },
          organizationId,
          integrationId,
          supabase,
        })
        break

      case 'mqtt':
        client = new MqttClient({
          type: 'mqtt',
          settings: {
            brokerUrl: settings.brokerUrl,
            port: settings.port,
            clientId: settings.clientId as string | undefined,
            username: settings.username as string | undefined,
            password: settings.password as string | undefined,
            useTls: settings.useTls as boolean | undefined,
            topicPrefix: settings.topicPrefix as string | undefined,
          },
          organizationId,
          integrationId,
          supabase,
        })
        break

      default:
        // Fall back to legacy test functions for non-migrated integrations
        return {
          success: false,
          message: `Integration type '${integrationType}' not yet migrated to unified client pattern`,
          details: {},
        }
    }

    // Call unified test() method
    const result = await client.test()
    return result

  } catch (error) {
    return {
      success: false,
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: String(error) },
    }
  }
}

// ===========================================================================
// Legacy Test Functions (Email, Slack, Webhook - not yet migrated to unified pattern)
// ===========================================================================

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

    // POST /integrations/test - Test integration connection (MUST come before general POST handler!)
    if (req.method === 'POST' && req.url.includes('/test')) {
      const url = new URL(req.url)
      const integrationId = url.searchParams.get('id')
      const startTime = Date.now()
      
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

      // Merge credentials from both database columns and settings object
      // This handles both old format (separate columns) and new format (in settings)
      const mergedSettings: IntegrationSettings = {
        ...(typedIntegration.settings || {}),
        // Override with database columns if they exist (preferred source of truth)
        ...(typedIntegration.project_id && { projectId: typedIntegration.project_id }),
      }

      // Get api_key from database if available
      // The database query should have returned api_key_encrypted, but it's not in our select
      // Let's fetch the full row including api_key_encrypted
      const { data: fullIntegration, error: fullFetchError } = await supabase
        .from('device_integrations')
        .select('api_key_encrypted, project_id')
        .eq('id', integrationId)
        .single()

      if (!fullFetchError && fullIntegration) {
        // Add credentials from database columns to merged settings
        const fullIntegrationData = fullIntegration as { api_key_encrypted?: string; project_id?: string }
        if (fullIntegrationData.api_key_encrypted) {
          mergedSettings.apiKey = fullIntegrationData.api_key_encrypted
        }
        if (fullIntegrationData.project_id) {
          mergedSettings.projectId = fullIntegrationData.project_id
        }
      }

      // Test based on integration type
      let testResult = { success: true, message: '', details: {} }

      try {
        // Use unified client pattern for supported integrations
        const unifiedIntegrations = ['golioth', 'aws_iot', 'azure_iot', 'google_iot', 'mqtt']
        
        if (unifiedIntegrations.includes(typedIntegration.integration_type)) {
          testResult = await testIntegrationUnified(
            supabase,
            typedIntegration.integration_type,
            mergedSettings,
            typedIntegration.organization_id,
            typedIntegration.id
          )
        } else {
          // Fall back to legacy test functions for non-migrated integrations
          switch (typedIntegration.integration_type) {
            case 'email':
              testResult = await testEmailIntegration(mergedSettings)
              break
            
            case 'slack':
              testResult = await testSlackIntegration(mergedSettings)
              break
            
            case 'webhook':
              testResult = await testWebhookIntegration(mergedSettings)
              break
            
            default:
              testResult = {
                success: false,
                message: `Testing not implemented for ${typedIntegration.integration_type}`,
                details: {}
              }
          }
        }
      } catch (testError) {
        console.error('Test execution error:', testError)
        testResult = {
          success: false,
          message: testError instanceof Error ? testError.message : 'Test execution failed',
          details: {}
        }
      }

      // Log activity for this test
      const responseTime = Date.now() - startTime
      await logActivity(supabase, {
        organizationId: typedIntegration.organization_id,
        integrationId: integrationId,
        direction: 'outgoing',
        activityType: 'test_connection',
        method: 'TEST',
        endpoint: `${typedIntegration.integration_type} test connection`,
        requestHeaders: sanitizeHeaders(req.headers),
        status: testResult.success ? 'success' : 'failed',
        responseStatus: testResult.success ? 200 : 400,
        responseBody: testResult.details,
        responseTimeMs: responseTime,
        errorMessage: testResult.success ? undefined : testResult.message,
        userId: userContext.userId,
        ipAddress: getIpAddress(req),
        userAgent: req.headers.get('user-agent') || undefined,
        metadata: {
          integrationType: typedIntegration.integration_type,
          integrationName: typedIntegration.name,
          testMessage: testResult.message
        }
      })

      if (testResult.success) {
        return createSuccessResponse({ 
          ...testResult,
          integration: {
            id: typedIntegration.id,
            name: typedIntegration.name,
            type: typedIntegration.integration_type
          }
        })
      } else {
        return createAuthErrorResponse(testResult.message, 400)
      }
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

      // Extract credentials from settings if they're there (frontend sends them in settings)
      // This handles both old format (api_key/project_id as separate fields) and new format (in settings)
      const finalApiKey = api_key || settings?.apiKey || settings?.api_key
      const finalProjectId = project_id || settings?.projectId || settings?.project_id
      const finalBaseUrl = base_url || settings?.baseUrl || settings?.base_url

      // Create integration - RLS will enforce permissions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newIntegration, error } = await supabase
        .from('device_integrations')
        .insert({
          organization_id,
          integration_type,
          name,
          settings: settings || {},
          api_key_encrypted: finalApiKey, // TODO: Encrypt this properly
          project_id: finalProjectId,
          base_url: finalBaseUrl,
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
      
      // Extract credentials from settings if they're there (frontend sends them in settings)
      const finalApiKey = api_key || settings?.apiKey || settings?.api_key
      const finalProjectId = project_id || settings?.projectId || settings?.project_id
      const finalBaseUrl = base_url || settings?.baseUrl || settings?.base_url
      
      if (finalApiKey !== undefined) updates.api_key_encrypted = finalApiKey // TODO: Encrypt properly
      if (finalProjectId !== undefined) updates.project_id = finalProjectId
      if (finalBaseUrl !== undefined) updates.base_url = finalBaseUrl
      
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