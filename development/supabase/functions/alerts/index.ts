import { createEdgeFunction, createSuccessResponse, DatabaseError } from '../_shared/request-handler.ts'
import { 
  getUserContext, 
  resolveOrganizationId,
  getTargetOrganizationId,
  createServiceClient
} from '../_shared/auth.ts'

export default createEdgeFunction(async ({ req }) => {
  // Get authenticated user context
  const userContext = await getUserContext(req)
  
  // Use service_role client to bypass RLS — authorization handled by resolveOrganizationId
  const supabase = createServiceClient()

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500) // Cap at 500
      const requestedOrgId = url.searchParams.get('organization_id')
      const severityFilter = url.searchParams.get('severity') // Filter by severity
      const resolvedFilter = url.searchParams.get('resolved') // Filter by resolution status
      
      // Determine which organization to query — supports multi-org via organization_members
      const organizationId = await resolveOrganizationId(userContext, requestedOrgId)
      
      if (!organizationId && !userContext.isSuperAdmin) {
        throw new DatabaseError('User has no organization access', 403)
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
        throw new DatabaseError(`Failed to fetch alerts: ${error.message}`)
      }

      // Transform alerts for response
      // deno-lint-ignore no-explicit-any
      const transformedAlerts = alerts?.map((alert: any) => ({
        id: alert.id,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        alertType: alert.alert_type,
        category: alert.category || 'system', // Added for Issue #108
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

    // POST /alerts/bulk-acknowledge - Bulk acknowledge multiple alerts (Issue #108)
    if (req.method === 'POST' && req.url.includes('/bulk-acknowledge')) {
      const body = await req.json()
      const { alert_ids, organization_id, acknowledgement_type, notes } = body

      if (!alert_ids || !Array.isArray(alert_ids) || alert_ids.length === 0) {
        throw new Error('alert_ids array is required')
      }

      // Verify user has access to this organization
      const targetOrgId = getTargetOrganizationId(userContext, organization_id)
      if (!targetOrgId && !userContext.isSuperAdmin) {
        throw new DatabaseError('Organization ID required', 400)
      }

      // Verify all alerts belong to the organization
      const { data: alertsToAck, error: verifyError } = await supabase
        .from('alerts')
        .select('id, organization_id')
        .in('id', alert_ids)

      if (verifyError) {
        throw new DatabaseError(`Failed to verify alerts: ${verifyError.message}`)
      }

      // Check access for each alert
      const invalidAlerts = alertsToAck?.filter(alert => 
        !userContext.isSuperAdmin && alert.organization_id !== userContext.organizationId
      )

      if (invalidAlerts && invalidAlerts.length > 0) {
        throw new DatabaseError('You do not have access to some of these alerts', 403)
      }

      // Bulk insert acknowledgements
      const acknowledgements = alert_ids.map(alertId => ({
        alert_id: alertId,
        user_id: userContext.userId,
        organization_id: targetOrgId,
        acknowledgement_type: acknowledgement_type || 'acknowledged',
        notes: notes || null
      }))

      const { data, error } = await supabase
        .from('alert_acknowledgements')
        .insert(acknowledgements)
        .select()

      if (error) {
        console.error('Failed to bulk acknowledge alerts:', error)
        throw new DatabaseError(`Failed to acknowledge alerts: ${error.message}`)
      }

      return createSuccessResponse({ 
        acknowledged_count: data?.length || 0,
        acknowledgements: data,
        message: `Successfully acknowledged ${data?.length} alert(s)`
      })
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      // Handle alert acknowledgement/update
      const url = new URL(req.url)
      const pathParts = url.pathname.split('/')
      const alertId = pathParts[pathParts.length - 2] // .../alerts/{id}/acknowledge
      const action = pathParts[pathParts.length - 1] // acknowledge, resolve, etc.

      if (!alertId) {
        throw new Error('Alert ID is required')
      }

      // Verify user has access to this alert's organization
      const { data: alert, error: fetchError } = await supabase
        .from('alerts')
        .select('organization_id')
        .eq('id', alertId)
        .single()

      if (fetchError || !alert) {
        throw new DatabaseError('Alert not found', 404)
      }

      // Check if user has access to this organization
      if (!userContext.isSuperAdmin && alert.organization_id !== userContext.organizationId) {
        throw new DatabaseError('You do not have access to this alert', 403)
      }

      // deno-lint-ignore no-explicit-any
      let updateData: any = {}

      if (action === 'acknowledge') {
        // Insert into alert_acknowledgements table instead of updating alerts
        const body = await req.json()
        const acknowledgementType = body.acknowledgement_type || 'acknowledged'
        const notes = body.notes || null

        const { data: acknowledgement, error: ackError } = await supabase
          .from('alert_acknowledgements')
          .insert({
            alert_id: alertId,
            user_id: userContext.userId,
            organization_id: alert.organization_id,
            acknowledgement_type: acknowledgementType,
            notes: notes
          })
          .select()
          .single()

        if (ackError) {
          console.error('Failed to acknowledge alert:', ackError)
          throw new DatabaseError(`Failed to acknowledge alert: ${ackError.message}`)
        }

        return createSuccessResponse({ 
          acknowledgement,
          message: 'Alert acknowledged successfully'
        })
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
        .update(updateData as any)
        .eq('id', alertId)
        .select()
        .single()

      if (updateError) {
        console.error('Failed to update alert:', updateError)
        throw new DatabaseError(`Failed to update alert: ${updateError.message}`)
      }

      return createSuccessResponse({ 
        alert: updated,
        message: `Alert ${action || 'updated'} successfully`
      })
    }

  throw new Error('Method not allowed')
}, {
  allowedMethods: ['GET', 'POST', 'PATCH', 'PUT']
})