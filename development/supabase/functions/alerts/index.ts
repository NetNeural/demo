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
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500) // Cap at 500
      const requestedOrgId = url.searchParams.get('organization_id')
      const severityFilter = url.searchParams.get('severity') // Filter by severity
      const resolvedFilter = url.searchParams.get('resolved') // Filter by resolution status
      
      // Determine which organization to query based on user's role
      const organizationId = getTargetOrganizationId(userContext, requestedOrgId)
      
      if (!organizationId && !userContext.isSuperAdmin) {
        return createAuthErrorResponse('User has no organization access', 403)
      }

      // Build query - RLS will enforce access automatically
      let query = supabase
        .from('alerts')
        .select(`
          *,
          devices!device_id(name, device_type)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      // Only filter by org if specified (super admins can query all orgs)
      if (organizationId) {
        query = query.eq('organization_id', organizationId)
      }

      // Apply additional filters
      if (severityFilter) {
        query = query.eq('severity', severityFilter)
      }

      if (resolvedFilter !== null) {
        const isResolved = resolvedFilter === 'true'
        query = query.eq('is_resolved', isResolved)
      }

      // Execute query - RLS ensures user can only see allowed alerts
      const { data: alerts, error } = await query

      if (error) {
        console.error('Database error:', error)
        return createAuthErrorResponse(`Failed to fetch alerts: ${error.message}`, 500)
      }

      // Transform alerts for response
      const transformedAlerts = alerts?.map((alert: any) => ({
        id: alert.id,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        alertType: alert.alert_type,
        deviceName: alert.devices?.name || 'Unknown Device',
        deviceType: alert.devices?.device_type || 'Unknown',
        deviceId: alert.device_id,
        timestamp: alert.created_at,
        isResolved: alert.is_resolved,
        resolvedAt: alert.resolved_at,
        resolvedBy: alert.resolved_by,
        metadata: alert.metadata
      })) || []

      return createSuccessResponse({ 
        alerts: transformedAlerts,
        count: transformedAlerts.length,
        limit,
        organizationId,
        filters: {
          severity: severityFilter,
          resolved: resolvedFilter
        }
      })
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      // Handle alert acknowledgement/update
      const url = new URL(req.url)
      const pathParts = url.pathname.split('/')
      const alertId = pathParts[pathParts.length - 2] // .../alerts/{id}/acknowledge
      const action = pathParts[pathParts.length - 1] // acknowledge, resolve, etc.

      if (!alertId) {
        return createAuthErrorResponse('Alert ID is required', 400)
      }

      // Verify user has access to this alert's organization
      const { data: alert, error: fetchError } = await supabase
        .from('alerts')
        .select('organization_id')
        .eq('id', alertId)
        .single()

      if (fetchError || !alert) {
        return createAuthErrorResponse('Alert not found', 404)
      }

      // Check if user has access to this organization
      if (!userContext.isSuperAdmin && alert.organization_id !== userContext.organizationId) {
        return createAuthErrorResponse('You do not have access to this alert', 403)
      }

      let updateData: any = {}

      if (action === 'acknowledge') {
        updateData = {
          is_acknowledged: true,
          acknowledged_by: userContext.userId,
          acknowledged_at: new Date().toISOString()
        }
      } else if (action === 'resolve') {
        updateData = {
          is_resolved: true,
          resolved_by: userContext.userId,
          resolved_at: new Date().toISOString()
        }
      } else {
        // Generic update from request body
        const body = await req.json()
        updateData = body
      }

      // Update the alert
      const { data: updated, error: updateError } = await supabase
        .from('alerts')
        .update(updateData)
        .eq('id', alertId)
        .select()
        .single()

      if (updateError) {
        console.error('Failed to update alert:', updateError)
        return createAuthErrorResponse(`Failed to update alert: ${updateError.message}`, 500)
      }

      return createSuccessResponse({ 
        alert: updated,
        message: `Alert ${action || 'updated'} successfully`
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