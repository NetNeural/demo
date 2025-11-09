import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { 
  getUserContext, 
  getTargetOrganizationId,
  createAuthenticatedClient,
  createAuthErrorResponse,
  createSuccessResponse,
  corsHeaders 
} from '../_shared/auth.ts'
import { logActivity, getIpAddress } from '../_shared/activity-logger.ts'

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
      // Exclude soft-deleted devices
      let query = supabase
        .from('devices')
        .select(`
          *,
          locations!location_id(name),
          departments!department_id(name),
          device_integrations!integration_id(name)
        `)
        .is('deleted_at', null)
      
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

    if (req.method === 'PUT') {
      const url = new URL(req.url)
      const pathParts = url.pathname.split('/')
      const deviceId = pathParts[pathParts.length - 1]
      
      if (!deviceId || deviceId === 'devices') {
        return createAuthErrorResponse('Device ID is required for updates', 400)
      }

      const body = await req.json()
      const { 
        organization_id,
        name, 
        device_type, 
        model, 
        serial_number, 
        firmware_version,
        location 
      } = body

      // Verify user has access to this device's organization
      const targetOrgId = getTargetOrganizationId(userContext, organization_id)
      
      if (!targetOrgId && !userContext.isSuperAdmin) {
        return createAuthErrorResponse('User has no organization access', 403)
      }

      // Build update object with proper typing
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      }

      if (name !== undefined) updates.name = name
      if (device_type !== undefined) updates.device_type = device_type
      if (model !== undefined) updates.model = model
      if (serial_number !== undefined) updates.serial_number = serial_number
      if (firmware_version !== undefined) updates.firmware_version = firmware_version
      // Note: location is read-only display field; use location_id to change device location

      // Update device - RLS will enforce access automatically
      const { data: updatedDevice, error: updateError } = await supabase
        .from('devices')
        .update(updates)
        .eq('id', deviceId)
        .select()
        .single()

      if (updateError) {
        console.error('Update error:', updateError)
        return createAuthErrorResponse(`Failed to update device: ${updateError.message}`, 500)
      }

      return createSuccessResponse({ 
        device: updatedDevice,
        message: 'Device updated successfully'
      })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const { 
        organization_id,
        device_id,
        name, 
        device_type, 
        model, 
        serial_number, 
        firmware_version,
        location 
      } = body

      // Verify required fields
      if (!name || !device_type) {
        return createAuthErrorResponse('Name and device type are required', 400)
      }

      // Verify user has access to this organization
      const targetOrgId = getTargetOrganizationId(userContext, organization_id)
      
      if (!targetOrgId) {
        return createAuthErrorResponse('User has no organization access', 403)
      }

      // Create device - RLS will enforce access automatically
      const { data: newDevice, error: createError } = await supabase
        .from('devices')
        .insert({
          organization_id: targetOrgId,
          external_device_id: device_id || null,
          name,
          device_type,
          model: model || null,
          serial_number: serial_number || null,
          firmware_version: firmware_version || null,
          status: 'offline'
        })
        .select()
        .single()

      if (createError) {
        console.error('Create error:', createError)
        return createAuthErrorResponse(`Failed to create device: ${createError.message}`, 500)
      }

      return createSuccessResponse({ 
        device: newDevice,
        message: 'Device created successfully'
      }, 201)
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url)
      const pathParts = url.pathname.split('/')
      const deviceId = pathParts[pathParts.length - 1]
      
      if (!deviceId || deviceId === 'devices') {
        return createAuthErrorResponse('Device ID is required for deletion', 400)
      }

      const body = await req.json()
      const { organization_id } = body

      // Verify user has access to this device's organization
      const targetOrgId = getTargetOrganizationId(userContext, organization_id)
      
      if (!targetOrgId && !userContext.isSuperAdmin) {
        return createAuthErrorResponse('User has no organization access', 403)
      }

      // Soft delete: set deleted_at timestamp instead of hard delete
      // This preserves device history and relationships
      const { error: deleteError } = await supabase
        .from('devices')
        // @ts-expect-error - deleted_at column exists but not in generated types
        .update({ 
          deleted_at: new Date().toISOString()
        })
        .eq('id', deviceId)

      if (deleteError) {
        console.error('Delete error:', deleteError)
        return createAuthErrorResponse(`Failed to delete device: ${deleteError.message}`, 500)
      }

      return createSuccessResponse({ 
        message: 'Device deleted successfully'
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