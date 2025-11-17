import { createEdgeFunction, createSuccessResponse, DatabaseError } from '../_shared/request-handler.ts'
import { 
  getUserContext, 
  getTargetOrganizationId,
  createAuthenticatedClient
} from '../_shared/auth.ts'

export default createEdgeFunction(async ({ req }) => {
  // Get authenticated user context
  const userContext = await getUserContext(req)
  
  // Create authenticated Supabase client (respects RLS)
  const supabase = createAuthenticatedClient(req)

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const pathParts = url.pathname.split('/')
      const deviceId = pathParts[pathParts.indexOf('devices') + 1]
      
      // GET /devices/{id} - Get single device
      if (deviceId && deviceId !== 'devices') {
        const { data: device, error: deviceError } = await supabase
          .from('devices')
          .select(`
            *,
            locations!location_id(name),
            departments!department_id(name),
            device_integrations!integration_id(name, integration_type)
          `)
          .eq('id', deviceId)
          .is('deleted_at', null)
          .single()

        if (deviceError) {
          console.error('Database error:', deviceError)
          throw new DatabaseError(`Failed to fetch device: ${deviceError.message}`, 404)
        }

        if (!device) {
          throw new DatabaseError('Device not found', 404)
        }

        // Transform device for response
        const transformedDevice = {
          id: device.id,
          name: device.name,
          device_type: device.device_type,
          model: device.model,
          serial_number: device.serial_number,
          status: device.status || 'offline',
          firmware_version: device.firmware_version,
          location_id: device.location_id,
          department_id: device.department_id,
          last_seen: device.last_seen,
          last_seen_online: device.last_seen_online,
          last_seen_offline: device.last_seen_offline,
          battery_level: device.battery_level,
          signal_strength: device.signal_strength,
          external_device_id: device.external_device_id,
          integration_id: device.integration_id,
          hardware_ids: device.hardware_ids,
          cohort_id: device.cohort_id,
          metadata: device.metadata,
          organization_id: device.organization_id,
          created_at: device.created_at,
          updated_at: device.updated_at,
          
          // Aliases for compatibility
          type: device.device_type,
          location: device.locations?.name || device.departments?.name || null,
          lastSeen: device.last_seen,
          batteryLevel: device.battery_level,
          isExternallyManaged: device.external_device_id !== null,
          externalDeviceId: device.external_device_id,
          integrationName: device.device_integrations?.name || null,
          integrationType: device.device_integrations?.integration_type || null
        }

        return createSuccessResponse({ 
          device: transformedDevice
        })
      }
      
      // GET /devices - List all devices
      const requestedOrgId = url.searchParams.get('organization_id')
      
      // Determine which organization to query based on user's role
      const organizationId = getTargetOrganizationId(userContext, requestedOrgId)
      
      if (!organizationId && !userContext.isSuperAdmin) {
        throw new DatabaseError('User has no organization access', 403)
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
        throw new DatabaseError(`Failed to fetch devices: ${error.message}`)
      }

      // Transform devices for response
      interface DeviceWithRelations {
        id: string
        name: string
        device_type: string
        status: string
        last_seen: string | null
        locations?: { name: string } | null
        departments?: { name: string } | null
        device_integrations?: { name: string } | null
        [key: string]: unknown
      }
      
      const transformedDevices = devices?.map((device: DeviceWithRelations) => ({
        // Database fields
        id: device.id,
        name: device.name,
        device_type: device.device_type,
        model: device.model,
        serial_number: device.serial_number,
        status: device.status || 'offline',
        firmware_version: device.firmware_version,
        location_id: device.location_id,
        department_id: device.department_id,
        last_seen: device.last_seen,
        battery_level: device.battery_level,
        signal_strength: device.signal_strength,
        external_device_id: device.external_device_id,
        integration_id: device.integration_id,
        updated_at: device.updated_at,
        
        // Transformed/computed fields for display
        type: device.device_type, // Alias for compatibility
        location: device.locations?.name || device.departments?.name || 'Unknown',
        lastSeen: device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never',
        batteryLevel: device.battery_level,
        isExternallyManaged: device.external_device_id !== null,
        externalDeviceId: device.external_device_id,
        integrationName: device.device_integrations?.name || null
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
        throw new Error('Device ID is required for updates')
      }

      const body = await req.json()
      const { 
        organization_id,
        name, 
        device_type, 
        model, 
        serial_number, 
        firmware_version,
        location_id,
        department_id,
        status,
        metadata
      } = body

      // Verify user has access to this device's organization
      const targetOrgId = getTargetOrganizationId(userContext, organization_id)
      
      if (!targetOrgId && !userContext.isSuperAdmin) {
        throw new DatabaseError('User has no organization access', 403)
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
      if (location_id !== undefined) updates.location_id = location_id
      if (department_id !== undefined) updates.department_id = department_id
      if (status !== undefined) updates.status = status
      if (metadata !== undefined) updates.metadata = metadata

      // Update device - RLS will enforce access automatically
      const { data: updatedDevice, error: updateError } = await supabase
        .from('devices')
        .update(updates as any)
        .eq('id', deviceId)
        .select()
        .single()

      if (updateError) {
        console.error('Update error:', updateError)
        throw new DatabaseError(`Failed to update device: ${updateError.message}`)
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
        location_id
      } = body

      // Verify required fields
      if (!name || !device_type) {
        throw new Error('Name and device type are required')
      }

      // Verify user has access to this organization
      const targetOrgId = getTargetOrganizationId(userContext, organization_id)
      
      if (!targetOrgId) {
        throw new DatabaseError('User has no organization access', 403)
      }

      // Create new device - RLS will enforce access automatically
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
          location_id: location_id || null,
          status: 'offline'
        } as any)
        .select()
        .single()

      if (createError) {
        console.error('Create error:', createError)
        throw new DatabaseError(`Failed to create device: ${createError.message}`)
      }

      return createSuccessResponse({ 
        device: newDevice,
        message: 'Device created successfully'
      }, { status: 201 })
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url)
      const pathParts = url.pathname.split('/')
      const deviceId = pathParts[pathParts.length - 1]
      
      if (!deviceId || deviceId === 'devices') {
        throw new Error('Device ID is required for deletion')
      }

      const body = await req.json()
      const { organization_id } = body

      // Verify user has access to this device's organization
      const targetOrgId = getTargetOrganizationId(userContext, organization_id)
      
      if (!targetOrgId && !userContext.isSuperAdmin) {
        throw new DatabaseError('User has no organization access', 403)
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
        throw new DatabaseError(`Failed to delete device: ${deleteError.message}`)
      }

      return createSuccessResponse({ 
        message: 'Device deleted successfully'
      })
    }

    if (req.method === 'PATCH') {
      const url = new URL(req.url)
      const pathParts = url.pathname.split('/')
      const deviceId = pathParts[pathParts.indexOf('devices') + 1]
      const action = pathParts[pathParts.length - 1]
      
      if (!deviceId || deviceId === 'devices') {
        throw new Error('Device ID is required')
      }

      // Handle device-integration mapping actions
      if (action === 'map-external') {
        const body = await req.json()
        const { integration_id, external_device_id } = body

        if (!integration_id || !external_device_id) {
          throw new Error('integration_id and external_device_id are required')
        }

        // Update device with external mapping
        const { data: updatedDevice, error: mapError } = await supabase
          .from('devices')
          .update({
            integration_id,
            external_device_id,
            updated_at: new Date().toISOString()
          } as any)
          .eq('id', deviceId)
          .select()
          .single()

        if (mapError) {
          console.error('Map external error:', mapError)
          throw new DatabaseError(`Failed to map device: ${mapError.message}`)
        }

        return createSuccessResponse({
          device: updatedDevice,
          message: 'Device mapped to external system successfully'
        })
      }

      if (action === 'unmap-external') {
        // Remove external mapping
        const { data: updatedDevice, error: unmapError } = await supabase
          .from('devices')
          .update({
            integration_id: null,
            external_device_id: null,
            updated_at: new Date().toISOString()
          } as any)
          .eq('id', deviceId)
          .select()
          .single()

        if (unmapError) {
          console.error('Unmap external error:', unmapError)
          throw new DatabaseError(`Failed to unmap device: ${unmapError.message}`)
        }

        return createSuccessResponse({
          device: updatedDevice,
          message: 'Device unmapped from external system successfully'
        })
      }

      if (action === 'status') {
        // Get device status with full integration info
        const { data: device, error: statusError } = await supabase
          .from('devices')
          .select(`
            *,
            device_integrations!integration_id (
              id,
              name,
              integration_type
            ),
            locations!location_id(name, description),
            departments!department_id(name, description)
          `)
          .eq('id', deviceId)
          .single()

        if (statusError) {
          console.error('Status error:', statusError)
          throw new DatabaseError(`Failed to fetch device status: ${statusError.message}`)
        }

        if (!device) {
          throw new DatabaseError('Device not found', 404)
        }

        // Transform to unified status format
        interface DeviceStatusData {
          id: string
          external_device_id: string | null
          organization_id: string
          name: string
          device_type: string
          status: string
          last_seen: string | null
          battery_level: number | null
          signal_strength: number | null
          integration_id: string | null
          firmware_version: string | null
          updated_at: string
          metadata: unknown
          locations?: { name: string } | null
          departments?: { name: string } | null
          device_integrations?: { id: string; name: string; integration_type: string } | null
          [key: string]: unknown
        }
        
        const deviceData = device as unknown as DeviceStatusData
        const deviceStatus = {
          deviceId: deviceData.id,
          externalDeviceId: deviceData.external_device_id || '',
          organizationId: deviceData.organization_id,
          name: deviceData.name,
          deviceType: deviceData.device_type,
          status: deviceData.status || 'offline',
          lastSeen: deviceData.last_seen,
          batteryLevel: deviceData.battery_level,
          signalStrength: deviceData.signal_strength,
          firmwareVersion: deviceData.firmware_version,
          location: deviceData.locations?.name || deviceData.departments?.name || null,
          integration: deviceData.device_integrations ? {
            id: deviceData.device_integrations.id,
            name: deviceData.device_integrations.name,
            type: deviceData.device_integrations.integration_type
          } : null,
          metadata: deviceData.metadata,
          updatedAt: deviceData.updated_at
        }

        return createSuccessResponse({
          status: deviceStatus
        })
      }

      throw new Error(`Unknown action: ${action}`)
    }

  throw new Error('Method not allowed')
}, {
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
})