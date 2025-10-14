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

      // Build query - RLS will enforce access automatically
      let query = supabase
        .from('devices')
        .select(`
          *,
          locations!location_id(name),
          departments!department_id(name),
          device_integrations!integration_id(name)
        `)
      
      // Only filter by org if specified (super admins can query all orgs)
      if (organizationId) {
        query = query.eq('organization_id', organizationId)
      }

      // Execute query - RLS ensures user can only see allowed devices
      const { data: devices, error } = await query

      if (error) {
        console.error('Database error:', error)
        return createAuthErrorResponse(`Failed to fetch devices: ${error.message}`, 500)
      }

      // Transform devices for response
      const transformedDevices = devices?.map((device: any) => ({
        id: device.id,
        name: device.name,
        device_name: device.name, // Alias for compatibility
        type: device.device_type,
        status: device.status || 'offline',
        location: device.locations?.name || device.departments?.name || 'Unknown',
        last_seen: device.last_seen,
        lastSeen: device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never',
        battery_level: device.battery_level,
        batteryLevel: device.battery_level,
        signal_strength: device.signal_strength,
        isExternallyManaged: device.external_device_id !== null,
        externalDeviceId: device.external_device_id,
        integrationName: device.device_integrations?.name || null,
        updated_at: device.updated_at
      })) || []

      return createSuccessResponse({ 
        devices: transformedDevices,
        count: transformedDevices.length,
        organizationId,
        queriedBy: userContext.email
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