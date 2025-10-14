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
      
      // Determine which organization to query based on user's role
      const organizationId = getTargetOrganizationId(userContext, requestedOrgId)
      
      if (!organizationId && !userContext.isSuperAdmin) {
        return createAuthErrorResponse('User has no organization access', 403)
      }

      // Build device query
      let deviceQuery = supabase
        .from('devices')
        .select('id, status, last_seen')
      
      if (organizationId) {
        deviceQuery = deviceQuery.eq('organization_id', organizationId)
      }

      // Build alerts query (last 24 hours)
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      let alertsQuery = supabase
        .from('alerts')
        .select('id, severity, is_resolved')
        .gte('created_at', last24h)
      
      if (organizationId) {
        alertsQuery = alertsQuery.eq('organization_id', organizationId)
      }

      // Execute queries in parallel
      const [devicesResult, alertsResult] = await Promise.all([
        deviceQuery,
        alertsQuery
      ])

      if (devicesResult.error) {
        console.error('Database error fetching devices:', devicesResult.error)
        return createAuthErrorResponse(`Failed to fetch devices: ${devicesResult.error.message}`, 500)
      }

      if (alertsResult.error) {
        console.error('Database error fetching alerts:', alertsResult.error)
        return createAuthErrorResponse(`Failed to fetch alerts: ${alertsResult.error.message}`, 500)
      }

      const devices = devicesResult.data || []
      const alerts = alertsResult.data || []

      // Calculate stats
      const totalDevices = devices.length
      const onlineDevices = devices.filter((d: any) => d.status === 'online').length
      const offlineDevices = devices.filter((d: any) => d.status === 'offline').length
      const warningDevices = devices.filter((d: any) => d.status === 'warning').length
      
      const totalAlerts = alerts.length
      const criticalAlerts = alerts.filter((a: any) => a.severity === 'critical').length
      const highAlerts = alerts.filter((a: any) => a.severity === 'high').length
      const unresolvedAlerts = alerts.filter((a: any) => !a.is_resolved).length

      // Calculate uptime percentage
      const uptimePercentage = totalDevices > 0 
        ? ((onlineDevices / totalDevices) * 100).toFixed(1) 
        : '0.0'

      // Determine system health
      let systemStatus = 'healthy'
      if (criticalAlerts > 0) {
        systemStatus = 'critical'
      } else if (unresolvedAlerts > 5 || warningDevices > 0) {
        systemStatus = 'warning'
      } else if (onlineDevices < totalDevices * 0.9) {
        systemStatus = 'degraded'
      }

      const stats = {
        devices: {
          total: totalDevices,
          online: onlineDevices,
          offline: offlineDevices,
          warning: warningDevices,
          uptimePercentage: parseFloat(uptimePercentage)
        },
        alerts: {
          total: totalAlerts,
          critical: criticalAlerts,
          high: highAlerts,
          unresolved: unresolvedAlerts,
          last24h: totalAlerts
        },
        system: {
          status: systemStatus,
          lastUpdated: new Date().toISOString()
        },
        metadata: {
          organizationId,
          queriedBy: userContext.email,
          isSuperAdmin: userContext.isSuperAdmin
        }
      }

      return createSuccessResponse(stats)
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