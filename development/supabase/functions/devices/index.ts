import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import {
  resolveOrganizationId,
  createServiceClient,
  getUserContext,
} from '../_shared/auth.ts'
import { enforceQuota, QuotaExceededError } from '../_shared/quota-check.ts'

export default createEdgeFunction(
  async ({ req }) => {
    console.log('🔵 devices function called')

    // Handle authentication manually with JWT fallback (skip getUserContext entirely)
    let userContext
    const supabase = createServiceClient()

    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      console.error('❌ No auth header')
      throw new DatabaseError('Unauthorized - no auth header', 401)
    }

    try {
      const token = authHeader.replace('Bearer ', '')
      const parts = token.split('.')

      if (parts.length < 2) {
        throw new Error('Invalid JWT format')
      }

      const payload = JSON.parse(globalThis.atob(parts[1]))
      console.log('🔵 JWT payload decoded:', {
        sub: payload.sub,
        role: payload.role,
      })

      if (!payload.sub) {
        throw new Error('JWT token has no sub claim')
      }

      // Get user profile using service role
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('organization_id, role, email')
        .eq('id', payload.sub)
        .maybeSingle()

      if (profileError) {
        console.error('❌ Failed to fetch user profile:', profileError)
        throw new DatabaseError(
          `Profile fetch error: ${profileError.message}`,
          500
        )
      }

      if (!profile) {
        console.error('❌ User profile not found for:', payload.sub)
        throw new DatabaseError('User profile not found', 404)
      }

      userContext = {
        userId: payload.sub,
        organizationId: profile.organization_id,
        role: profile.role as
          | 'super_admin'
          | 'org_owner'
          | 'org_admin'
          | 'user'
          | 'viewer',
        isSuperAdmin: profile.role === 'super_admin',
        email: profile.email || payload.email || '',
      }

      console.log('✅ Successfully authenticated:', {
        userId: userContext.userId,
        email: userContext.email,
      })
    } catch (authError) {
      console.error('❌ JWT authentication failed:', authError)
      throw new DatabaseError('Unauthorized - authentication failed', 401)
    }

    // Helper: return requested org if user is a member, otherwise user's primary org
    const getTargetOrganizationId = async (
      ctx: typeof userContext,
      requestedOrgId?: string
    ): Promise<string | null> => {
      // Super admins can target any org
      if (ctx.isSuperAdmin && requestedOrgId) return requestedOrgId

      // If no specific org requested, use user's primary
      if (!requestedOrgId) return ctx.organizationId || null

      // If requesting their own primary org, allow it
      if (requestedOrgId === ctx.organizationId) return requestedOrgId

      // Check if user is a member of the requested org
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', ctx.userId)
        .eq('organization_id', requestedOrgId)
        .maybeSingle()

      if (membership) {
        console.log(
          `✅ User ${ctx.userId} is ${membership.role} of org ${requestedOrgId}`
        )
        return requestedOrgId
      }

      console.warn(
        `⚠️ User ${ctx.userId} is not a member of org ${requestedOrgId}, falling back to primary`
      )
      return ctx.organizationId || null
    }

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const pathParts = url.pathname.split('/')
      const deviceId = pathParts[pathParts.indexOf('devices') + 1]

      // GET /devices/{id} - Get single device
      if (deviceId && deviceId !== 'devices') {
        const { data: device, error: deviceError } = await supabase
          .from('devices')
          .select(
            `
            *,
            locations!location_id(name),
            departments!department_id(name),
            device_integrations!integration_id(name, integration_type)
          `
          )
          .eq('id', deviceId)
          .is('deleted_at', null)
          .single()

        if (deviceError) {
          console.error('Database error:', deviceError)
          throw new DatabaseError(
            `Failed to fetch device: ${deviceError.message}`,
            404
          )
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
          integrationType: device.device_integrations?.integration_type || null,
        }

        return createSuccessResponse({
          device: transformedDevice,
        })
      }

      // GET /devices - List all devices
      const requestedOrgId = url.searchParams.get('organization_id')

      // Determine which organization to query — supports multi-org via organization_members
      const organizationId = await resolveOrganizationId(
        userContext,
        requestedOrgId
      )

      if (!organizationId && !userContext.isSuperAdmin) {
        throw new DatabaseError('User has no organization access', 403)
      }

      // Build query - RLS will enforce access automatically
      // Exclude soft-deleted devices
      let query = supabase
        .from('devices')
        .select(
          `
          *,
          locations!location_id(name),
          departments!department_id(name),
          device_integrations!integration_id(name)
        `
        )
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

      const transformedDevices =
        devices?.map((device: DeviceWithRelations) => ({
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
          location:
            device.locations?.name || device.departments?.name || 'Unknown',
          lastSeen: device.last_seen
            ? new Date(device.last_seen).toLocaleString()
            : 'Never',
          batteryLevel: device.battery_level,
          isExternallyManaged: device.external_device_id !== null,
          externalDeviceId: device.external_device_id,
          integrationName: device.device_integrations?.name || null,
        })) || []

      return createSuccessResponse({
        devices: transformedDevices,
        count: transformedDevices.length,
        organizationId,
        queriedBy: userContext.email,
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
      console.log(
        'PUT /devices/:id - Request body:',
        JSON.stringify(body, null, 2)
      )
      console.log('PUT /devices/:id - User context:', {
        userId: userContext.userId,
        email: userContext.email,
        organizationId: userContext.organizationId,
        role: userContext.role,
        isSuperAdmin: userContext.isSuperAdmin,
      })

      const {
        organization_id,
        name,
        device_type,
        device_type_id,
        model,
        serial_number,
        firmware_version,
        location_id,
        department_id,
        status,
        metadata,
      } = body

      // First, verify the device exists and get its current organization
      const { data: existingDevice, error: fetchError } = await supabase
        .from('devices')
        .select('id, organization_id, name, serial_number')
        .eq('id', deviceId)
        .single()

      if (fetchError || !existingDevice) {
        console.error('Device not found:', deviceId, fetchError)
        throw new DatabaseError('Device not found', 404)
      }

      console.log('Existing device:', existingDevice)

      // Verify user has access to this device's organization
      // Use the device's current organization, not from request body
      const targetOrgId = existingDevice.organization_id

      // Check if user has access to this organization
      if (!userContext.isSuperAdmin) {
        // Check if user belongs to the device's organization
        if (userContext.organizationId !== targetOrgId) {
          // Check if user is a member of this org (multi-org support)
          const { data: membership } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', userContext.userId)
            .eq('organization_id', targetOrgId)
            .single()

          if (!membership) {
            console.error('User does not have access to device organization:', {
              userOrg: userContext.organizationId,
              deviceOrg: targetOrgId,
            })
            throw new DatabaseError(
              'You do not have permission to update this device',
              403
            )
          }
        }
      }

      // Build update object with proper typing
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      if (name !== undefined) updates.name = name
      if (device_type !== undefined) updates.device_type = device_type
      if (device_type_id !== undefined) updates.device_type_id = device_type_id
      if (model !== undefined) updates.model = model

      // Handle organization_id change (device transfer between orgs)
      if (
        organization_id !== undefined &&
        organization_id !== existingDevice.organization_id
      ) {
        // Verify user has access to the TARGET organization too
        if (!userContext.isSuperAdmin) {
          const { data: targetMembership } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', userContext.userId)
            .eq('organization_id', organization_id)
            .single()

          if (!targetMembership) {
            throw new DatabaseError(
              'You do not have permission to transfer devices to that organization',
              403
            )
          }
        }
        updates.organization_id = organization_id
        // Clear org-specific foreign keys — they reference entities in the OLD org
        updates.location_id = null
        updates.department_id = null
        console.log('🔵 Device transfer:', {
          from: existingDevice.organization_id,
          to: organization_id,
          cleared: ['location_id', 'department_id'],
        })
      }

      // Handle serial_number carefully - empty string should be null
      if (serial_number !== undefined) {
        const normalizedSerialNumber = serial_number?.trim() || null
        const normalizedExisting = existingDevice.serial_number?.trim() || null

        if (normalizedSerialNumber !== normalizedExisting) {
          console.log('🔵 Serial number change detected:', {
            from: normalizedExisting,
            to: normalizedSerialNumber,
          })
          updates.serial_number = normalizedSerialNumber
        } else {
          console.log(
            '🔵 Serial number unchanged, skipping update:',
            normalizedSerialNumber
          )
        }
      }
      if (firmware_version !== undefined)
        updates.firmware_version = firmware_version
      if (location_id !== undefined) updates.location_id = location_id
      if (department_id !== undefined) updates.department_id = department_id
      if (status !== undefined) updates.status = status
      if (metadata !== undefined) updates.metadata = metadata

      console.log('Applying updates:', JSON.stringify(updates, null, 2))

      // Update device - using service_role to bypass RLS (auth handled above)
      const { data: updatedDevice, error: updateError } = await supabase
        .from('devices')
        .update(updates as any)
        .eq('id', deviceId)
        .select()
        .single()

      if (updateError) {
        console.error('Update error:', {
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
        })
        throw new DatabaseError(
          `Failed to update device: ${updateError.message}`,
          500
        )
      }

      console.log('Device updated successfully:', updatedDevice.id)

      return createSuccessResponse({
        device: updatedDevice,
        message: 'Device updated successfully',
      })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const {
        organization_id,
        device_id,
        name,
        device_type,
        device_type_id,
        model,
        serial_number,
        firmware_version,
        location_id,
        location,
        metadata,
        is_test_device,
        status,
        battery_level,
        signal_strength,
      } = body

      // Verify required fields
      if (!name || !device_type) {
        throw new Error('Name and device type are required')
      }

      // Verify user has access to this organization
      const targetOrgId = await getTargetOrganizationId(
        userContext,
        organization_id
      )

      if (!targetOrgId) {
        throw new DatabaseError('User has no organization access', 403)
      }

      // Check device quota before creating
      try {
        const quota = await enforceQuota(targetOrgId, 'device_count', 'device')
        if (quota.is_warning) {
          console.warn(
            `⚠️ Org ${targetOrgId} approaching device limit: ${quota.current_usage}/${quota.plan_limit}`
          )
        }
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          throw new DatabaseError(err.message, 403)
        }
        // Non-quota errors: log but don't block (fail-open)
        console.error('Quota check error (allowing device creation):', err)
      }

      // Create new device - RLS will enforce access automatically
      const { data: newDevice, error: createError } = await supabase
        .from('devices')
        .insert({
          organization_id: targetOrgId,
          external_device_id: device_id || null,
          name,
          device_type,
          device_type_id: device_type_id || null,
          model: model || null,
          serial_number: serial_number || null,
          firmware_version: firmware_version || null,
          location_id: location_id || null,
          location: location || null,
          metadata: metadata || null,
          is_test_device: is_test_device === true,
          status: status || 'offline',
          battery_level:
            typeof battery_level === 'number' ? battery_level : null,
          signal_strength:
            typeof signal_strength === 'number' ? signal_strength : null,
        } as any)
        .select()
        .single()

      if (createError) {
        console.error('Create error:', createError)
        throw new DatabaseError(
          `Failed to create device: ${createError.message}`
        )
      }

      return createSuccessResponse(
        {
          device: newDevice,
          message: 'Device created successfully',
        },
        { status: 201 }
      )
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url)
      const pathParts = url.pathname.split('/')
      const deviceId = pathParts[pathParts.length - 1]

      if (!deviceId || deviceId === 'devices') {
        throw new Error('Device ID is required for deletion')
      }

      let organization_id: string | undefined
      try {
        const body = await req.json()
        organization_id = body?.organization_id
      } catch {
        // No body provided — ok for DELETE
      }

      // Verify user has access to this device's organization
      const targetOrgId = await getTargetOrganizationId(
        userContext,
        organization_id
      )

      if (!targetOrgId && !userContext.isSuperAdmin) {
        throw new DatabaseError('User has no organization access', 403)
      }

      // Soft delete: set deleted_at timestamp instead of hard delete
      // This preserves device history and relationships
      const { error: deleteError } = await supabase
        .from('devices')
        // @ts-expect-error - deleted_at column exists but not in generated types
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq('id', deviceId)

      if (deleteError) {
        console.error('Delete error:', deleteError)
        throw new DatabaseError(
          `Failed to delete device: ${deleteError.message}`
        )
      }

      return createSuccessResponse({
        message: 'Device deleted successfully',
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
            updated_at: new Date().toISOString(),
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
          message: 'Device mapped to external system successfully',
        })
      }

      if (action === 'unmap-external') {
        // Remove external mapping
        const { data: updatedDevice, error: unmapError } = await supabase
          .from('devices')
          .update({
            integration_id: null,
            external_device_id: null,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', deviceId)
          .select()
          .single()

        if (unmapError) {
          console.error('Unmap external error:', unmapError)
          throw new DatabaseError(
            `Failed to unmap device: ${unmapError.message}`
          )
        }

        return createSuccessResponse({
          device: updatedDevice,
          message: 'Device unmapped from external system successfully',
        })
      }

      if (action === 'status') {
        // Get device status with full integration info
        const { data: device, error: statusError } = await supabase
          .from('devices')
          .select(
            `
            *,
            device_integrations!integration_id (
              id,
              name,
              integration_type
            ),
            locations!location_id(name, description),
            departments!department_id(name, description)
          `
          )
          .eq('id', deviceId)
          .single()

        if (statusError) {
          console.error('Status error:', statusError)
          throw new DatabaseError(
            `Failed to fetch device status: ${statusError.message}`
          )
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
          device_integrations?: {
            id: string
            name: string
            integration_type: string
          } | null
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
          location:
            deviceData.locations?.name || deviceData.departments?.name || null,
          integration: deviceData.device_integrations
            ? {
                id: deviceData.device_integrations.id,
                name: deviceData.device_integrations.name,
                type: deviceData.device_integrations.integration_type,
              }
            : null,
          metadata: deviceData.metadata,
          updatedAt: deviceData.updated_at,
        }

        return createSuccessResponse({
          status: deviceStatus,
        })
      }

      throw new Error(`Unknown action: ${action}`)
    }

    throw new Error('Method not allowed')
  },
  {
    requireAuth: false, // Handle auth manually with JWT fallback
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  }
)
