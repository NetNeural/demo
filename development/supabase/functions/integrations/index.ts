import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { 
  getUserContext, 
  getTargetOrganizationId,
  createAuthenticatedClient,
  createAuthErrorResponse,
  createSuccessResponse,
  corsHeaders 
} from '../_shared/auth.ts'

serve(async (req) => {
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
        (integrations || []).map(async (integration: any) => {
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