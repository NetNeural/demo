import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import {
  getUserContext,
  resolveOrganizationId,
  getTargetOrganizationId,
  createServiceClient,
} from '../_shared/auth.ts'

// ─── Multi-Org Membership Check (Bug #221 fix) ──────────────────────
// Checks if a user is a member of a given organization via organization_members.
// Uses service_role client to bypass RLS.
async function isUserMemberOfOrg(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .limit(1)
    .maybeSingle()
  return !!data
}

// ─── Resolution Notification Helper ───────────────────────────────────
async function sendResolutionNotification(
  supabase: ReturnType<typeof createServiceClient>,
  alertId: string,
  resolvedByUserId: string,
  acknowledgementType: string,
  notes?: string | null
) {
  try {
    // Fetch the full alert with device info + threshold metadata
    const { data: alert } = await supabase
      .from('alerts')
      .select('*, devices!device_id(name, device_type, organization_id)')
      .eq('id', alertId)
      .single()

    if (!alert) return

    // Look up who resolved it
    const { data: resolver } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', resolvedByUserId)
      .single()
    const resolverName =
      resolver?.full_name || resolver?.email || resolvedByUserId
    const resolvedAt = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
    })
    const alertNum = alert.alert_number
      ? `ALT-${alert.alert_number}`
      : alert.id.slice(0, 8)

    // Find threshold to get original notification recipients
    const thresholdId = alert.metadata?.threshold_id
    let recipientUserIds: string[] = []
    let recipientEmails: string[] = []
    let channels: string[] = ['email']

    if (thresholdId) {
      const { data: threshold } = await supabase
        .from('sensor_thresholds')
        .select('notify_user_ids, notify_emails, notification_channels')
        .eq('id', thresholdId)
        .single()

      if (threshold) {
        recipientUserIds = threshold.notify_user_ids || []
        recipientEmails = threshold.notify_emails || []
        channels = threshold.notification_channels || ['email']
      }
    }

    // If no threshold recipients, notify all org admins/owners
    if (recipientUserIds.length === 0 && recipientEmails.length === 0) {
      const orgId = alert.organization_id || alert.devices?.organization_id
      if (orgId) {
        const { data: members } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', orgId)
          .in('role', ['owner', 'admin'])
        recipientUserIds =
          members?.map((m: { user_id: string }) => m.user_id) || []
      }
    }

    if (recipientUserIds.length === 0 && recipientEmails.length === 0) return

    // Send resolution notification via send-alert-notifications
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Build a resolution message and temporarily update alert for the notification
    const originalTitle = alert.title
    const originalMessage = alert.message

    // Temporarily update alert fields for the notification template
    await supabase
      .from('alerts')
      .update({
        title: `✅ RESOLVED: ${alertNum} — ${originalTitle}`,
        message: `Resolved by ${resolverName} at ${resolvedAt}\nType: ${acknowledgementType}${notes ? `\nNotes: ${notes}` : ''}\n\nOriginal alert: ${originalMessage}`,
        severity: 'low', // Green/low severity for resolution
      })
      .eq('id', alertId)

    // Fire resolution notification
    await fetch(`${supabaseUrl}/functions/v1/send-alert-notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        alert_id: alertId,
        threshold_id: thresholdId || undefined,
        channels: channels,
        recipient_user_ids: recipientUserIds,
        recipient_emails: recipientEmails,
      }),
    })

    // Restore original alert fields
    await supabase
      .from('alerts')
      .update({
        title: originalTitle,
        message: originalMessage,
        severity: alert.severity,
      })
      .eq('id', alertId)

    console.log(
      `[alerts] Resolution notification sent for alert ${alertId} (${alertNum})`
    )
  } catch (err) {
    console.warn('[alerts] Resolution notification failed (non-fatal):', err)
  }
}

export default createEdgeFunction(
  async ({ req }) => {
    // Get authenticated user context
    const userContext = await getUserContext(req)

    // Use service_role client to bypass RLS — authorization handled by resolveOrganizationId
    const supabase = createServiceClient()

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const limit = Math.min(
        parseInt(url.searchParams.get('limit') || '50'),
        500
      ) // Cap at 500
      const offset = Math.max(
        parseInt(url.searchParams.get('offset') || '0'),
        0
      ) // Issue #269: Pagination offset
      const requestedOrgId = url.searchParams.get('organization_id')
      const severityFilter = url.searchParams.get('severity') // Filter by severity
      const resolvedFilter = url.searchParams.get('resolved') // Filter by resolution status

      // Determine which organization to query — supports multi-org via organization_members
      const organizationId = await resolveOrganizationId(
        userContext,
        requestedOrgId
      )

      if (!organizationId && !userContext.isSuperAdmin) {
        throw new DatabaseError('User has no organization access', 403)
      }

      // Build query - RLS will enforce access automatically
      // Issue #269: Use .range() for offset-based pagination and count: 'exact' for total
      let query = supabase
        .from('alerts')
        .select(
          `
          *,
          devices!device_id(name, device_type)
        `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

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
      const { data: alerts, error, count: totalCount } = await query

      if (error) {
        console.error('Database error:', error)
        throw new DatabaseError(`Failed to fetch alerts: ${error.message}`)
      }

      // Transform alerts for response
      // deno-lint-ignore no-explicit-any
      const transformedAlerts =
        alerts?.map((alert: any) => ({
          id: alert.id,
          alertNumber: alert.alert_number,
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
          snoozedUntil: alert.snoozed_until,
          snoozedBy: alert.snoozed_by,
          isSnoozed: alert.snoozed_until
            ? new Date(alert.snoozed_until) > new Date()
            : false,
          metadata: alert.metadata,
        })) || []

      return createSuccessResponse({
        alerts: transformedAlerts,
        count: transformedAlerts.length,
        totalCount: totalCount ?? transformedAlerts.length, // Issue #269: Total matching records for pagination
        limit,
        offset, // Issue #269: Current offset for pagination
        organizationId,
        filters: {
          severity: severityFilter,
          resolved: resolvedFilter,
        },
      })
    }

    // POST /alerts - Create a new alert (e.g., test alerts)
    if (req.method === 'POST' && !req.url.includes('/bulk-acknowledge')) {
      const body = await req.json()
      const {
        organization_id,
        device_id,
        alert_type,
        category,
        title,
        message,
        severity,
        metadata,
      } = body

      if (!organization_id || !device_id || !title) {
        throw new Error('organization_id, device_id, and title are required')
      }

      // Verify user has access to the organization
      const orgId = await resolveOrganizationId(userContext, organization_id)
      if (!orgId) {
        throw new DatabaseError(
          'User does not have access to this organization',
          403
        )
      }

      const { data: alert, error: insertError } = await supabase
        .from('alerts')
        .insert({
          organization_id: orgId,
          device_id,
          alert_type: alert_type || 'manual',
          category: category || 'system',
          title,
          message: message || '',
          severity: severity || 'warning',
          is_resolved: false,
          metadata: metadata || {},
        })
        .select()
        .single()

      if (insertError) {
        throw new DatabaseError(
          `Failed to create alert: ${insertError.message}`
        )
      }

      return createSuccessResponse({ alert })
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
        throw new DatabaseError(
          `Failed to verify alerts: ${verifyError.message}`
        )
      }

      // Check access for each alert — verify membership (Bug #221 fix)
      if (!userContext.isSuperAdmin) {
        const uniqueOrgIds = [
          ...new Set(
            alertsToAck?.map((a) => a.organization_id).filter(Boolean) || []
          ),
        ]
        const membershipChecks = await Promise.all(
          uniqueOrgIds.map(async (orgId) => ({
            orgId,
            isMember: await isUserMemberOfOrg(
              supabase,
              userContext.userId,
              orgId
            ),
          }))
        )
        const deniedOrgs = membershipChecks.filter((c) => !c.isMember)
        if (deniedOrgs.length > 0) {
          throw new DatabaseError(
            'You do not have access to some of these alerts',
            403
          )
        }
      }

      // Bulk insert acknowledgements
      const acknowledgements = alert_ids.map((alertId) => ({
        alert_id: alertId,
        user_id: userContext.userId,
        organization_id: targetOrgId,
        acknowledgement_type: acknowledgement_type || 'acknowledged',
        notes: notes || null,
      }))

      const { data, error } = await supabase
        .from('alert_acknowledgements')
        .insert(acknowledgements)
        .select()

      if (error) {
        console.error('Failed to bulk acknowledge alerts:', error)
        throw new DatabaseError(
          `Failed to acknowledge alerts: ${error.message}`
        )
      }

      // Mark all acknowledged alerts as resolved so they disappear from active list
      const { error: resolveError } = await supabase
        .from('alerts')
        .update({
          is_resolved: true,
          resolved_by: userContext.userId,
          resolved_at: new Date().toISOString(),
        })
        .in('id', alert_ids)

      if (resolveError) {
        console.error(
          'Failed to resolve bulk acknowledged alerts:',
          resolveError
        )
        // Non-fatal: acknowledgements were recorded, but alerts may still show
      }

      return createSuccessResponse({
        acknowledged_count: data?.length || 0,
        acknowledgements: data,
        message: `Successfully acknowledged ${data?.length} alert(s)`,
      })
    }

    // ─── GET /alerts/timeline/{alertId} ────────────────────────────────
    if (req.method === 'GET' && req.url.includes('/timeline/')) {
      const url = new URL(req.url)
      const pathParts = url.pathname.split('/')
      const alertId = pathParts[pathParts.length - 1]

      if (!alertId) throw new Error('Alert ID is required')

      // Verify access
      const { data: alert } = await supabase
        .from('alerts')
        .select('organization_id')
        .eq('id', alertId)
        .single()

      if (!alert) throw new DatabaseError('Alert not found', 404)

      if (!userContext.isSuperAdmin) {
        const hasMembership = await isUserMemberOfOrg(
          supabase,
          userContext.userId,
          alert.organization_id
        )
        if (!hasMembership) {
          throw new DatabaseError('Access denied', 403)
        }
      }

      // Fetch timeline events
      const { data: events, error: eventsError } = await supabase
        .from('alert_events')
        .select('*')
        .eq('alert_id', alertId)
        .order('created_at', { ascending: true })

      if (eventsError)
        throw new DatabaseError(
          `Failed to fetch timeline: ${eventsError.message}`
        )

      // Resolve user names for events that have user_ids
      const userIds = [
        ...new Set(
          (events || [])
            .filter((e: any) => e.user_id)
            .map((e: any) => e.user_id)
        ),
      ]
      let userMap: Record<string, string> = {}

      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', userIds)

        userMap = (users || []).reduce(
          (acc: Record<string, string>, u: any) => {
            acc[u.id] = u.full_name || u.email || u.id
            return acc
          },
          {}
        )
      }

      // Record 'viewed' event
      await supabase.from('alert_events').insert({
        alert_id: alertId,
        event_type: 'viewed',
        user_id: userContext.userId,
      })

      const enrichedEvents = (events || []).map((e: any) => ({
        ...e,
        userName: e.user_id ? userMap[e.user_id] || e.user_id : null,
      }))

      return createSuccessResponse({ events: enrichedEvents })
    }

    // ─── GET /alerts/stats ─────────────────────────────────────────────
    if (req.method === 'GET' && req.url.includes('/stats')) {
      const url = new URL(req.url)
      const requestedOrgId = url.searchParams.get('organization_id')
      const organizationId = await resolveOrganizationId(
        userContext,
        requestedOrgId
      )

      if (!organizationId && !userContext.isSuperAdmin) {
        throw new DatabaseError('Organization required', 403)
      }

      // Get stats from the view
      const { data: stats } = await supabase
        .from('alert_statistics')
        .select('*')
        .eq('organization_id', organizationId!)
        .single()

      // Get top alerting devices
      const { data: topDevices } = await supabase
        .from('alert_device_rankings')
        .select('*')
        .eq('organization_id', organizationId!)
        .order('alert_count', { ascending: false })
        .limit(5)

      return createSuccessResponse({
        stats: stats || {},
        topDevices: topDevices || [],
      })
    }

    // ─── POST /alerts/snooze ──────────────────────────────────────────
    if (req.method === 'POST' && req.url.includes('/snooze')) {
      const body = await req.json()
      const { alert_id, duration_minutes } = body

      if (!alert_id || !duration_minutes) {
        throw new Error('alert_id and duration_minutes are required')
      }

      // Verify access
      const { data: alert } = await supabase
        .from('alerts')
        .select('organization_id, title, alert_number')
        .eq('id', alert_id)
        .single()

      if (!alert) throw new DatabaseError('Alert not found', 404)
      if (!userContext.isSuperAdmin) {
        const hasMembership = await isUserMemberOfOrg(
          supabase,
          userContext.userId,
          alert.organization_id
        )
        if (!hasMembership) {
          throw new DatabaseError('Access denied', 403)
        }
      }

      const snoozedUntil = new Date(
        Date.now() + duration_minutes * 60 * 1000
      ).toISOString()

      const { error: snoozeError } = await supabase
        .from('alerts')
        .update({
          snoozed_until: snoozedUntil,
          snoozed_by: userContext.userId,
        })
        .eq('id', alert_id)

      if (snoozeError)
        throw new DatabaseError(`Failed to snooze: ${snoozeError.message}`)

      const alertNum = alert.alert_number
        ? `ALT-${alert.alert_number}`
        : alert_id.slice(0, 8)

      return createSuccessResponse({
        message: `${alertNum} snoozed for ${duration_minutes} minutes`,
        snoozedUntil,
      })
    }

    // ─── POST /alerts/unsnooze ────────────────────────────────────────
    if (req.method === 'POST' && req.url.includes('/unsnooze')) {
      const body = await req.json()
      const { alert_id } = body

      if (!alert_id) throw new Error('alert_id is required')

      const { data: alert } = await supabase
        .from('alerts')
        .select('organization_id')
        .eq('id', alert_id)
        .single()

      if (!alert) throw new DatabaseError('Alert not found', 404)
      if (!userContext.isSuperAdmin) {
        const hasMembership = await isUserMemberOfOrg(
          supabase,
          userContext.userId,
          alert.organization_id
        )
        if (!hasMembership) {
          throw new DatabaseError('Access denied', 403)
        }
      }

      const { error } = await supabase
        .from('alerts')
        .update({ snoozed_until: null, snoozed_by: userContext.userId })
        .eq('id', alert_id)

      if (error) throw new DatabaseError(`Failed to unsnooze: ${error.message}`)

      return createSuccessResponse({ message: 'Alert unsnoozed' })
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

      // Check if user has access to this alert's organization (Bug #221 fix: check membership, not default org)
      if (!userContext.isSuperAdmin) {
        const hasMembership = await isUserMemberOfOrg(
          supabase,
          userContext.userId,
          alert.organization_id
        )
        if (!hasMembership) {
          throw new DatabaseError('You do not have access to this alert', 403)
        }
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
            notes: notes,
          })
          .select()
          .single()

        if (ackError) {
          console.error('Failed to acknowledge alert:', ackError)
          throw new DatabaseError(
            `Failed to acknowledge alert: ${ackError.message}`
          )
        }

        // Also mark the alert as resolved so it disappears from active alerts list
        const { error: resolveError } = await supabase
          .from('alerts')
          .update({
            is_resolved: true,
            resolved_by: userContext.userId,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', alertId)

        if (resolveError) {
          console.error('Failed to resolve acknowledged alert:', resolveError)
          // Non-fatal: acknowledgement was recorded
        }

        // Send resolution notification to original recipients
        sendResolutionNotification(
          supabase,
          alertId,
          userContext.userId,
          acknowledgementType,
          notes
        ).catch(() => {}) // Fire-and-forget

        return createSuccessResponse({
          acknowledgement,
          message: 'Alert acknowledged successfully',
        })
      } else if (action === 'resolve') {
        updateData = {
          is_resolved: true,
          resolved_by: userContext.userId,
          resolved_at: new Date().toISOString(),
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
        throw new DatabaseError(
          `Failed to update alert: ${updateError.message}`
        )
      }

      return createSuccessResponse({
        alert: updated,
        message: `Alert ${action || 'updated'} successfully`,
      })
    }

    throw new Error('Method not allowed')
  },
  {
    allowedMethods: ['GET', 'POST', 'PATCH', 'PUT'],
  }
)
