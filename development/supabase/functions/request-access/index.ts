// ===========================================================================
// Edge Function: request-access
// ===========================================================================
// Cross-org temporary access request system (Issue #35)
//
// POST   - Create a new access request (NetNeural admin+ only)
// GET    - List access requests (own requests or requests targeting your org)
// PATCH  - Approve or deny an access request (target org owner/admin only)
// DELETE - Revoke an active access grant or cancel a pending request
// ===========================================================================

import {
  createEdgeFunction,
  createSuccessResponse,
  createErrorResponse,
  DatabaseError,
  getRequestBody,
} from '../_shared/request-handler.ts'
import { createServiceClient, resolveOrganizationId } from '../_shared/auth.ts'

interface AccessRequestBody {
  target_org_id: string
  reason: string
  requested_duration?: string // '1h' | '4h' | '24h' | '48h' | '7d'
}

interface ApprovalBody {
  request_id: string
  action: 'approve' | 'deny'
  denial_reason?: string
}

interface RevokeBody {
  request_id: string
}

// Map shorthand durations to PostgreSQL intervals
const DURATION_MAP: Record<string, string> = {
  '1h': '1 hour',
  '4h': '4 hours',
  '24h': '24 hours',
  '48h': '48 hours',
  '7d': '7 days',
}

export default createEdgeFunction(
  async ({ req, userContext, method, url }) => {
    if (!userContext) {
      throw new DatabaseError('Authentication required', 401)
    }

    const supabase = createServiceClient()
    const params = Object.fromEntries(url.searchParams)

    // ─── POST: Create Access Request ────────────────────────────────────
    if (method === 'POST') {
      const body = await getRequestBody<AccessRequestBody>(req)
      const { target_org_id, reason, requested_duration = '4h' } = body

      if (!target_org_id || !reason) {
        throw new DatabaseError('target_org_id and reason are required', 400)
      }

      if (reason.length < 10) {
        throw new DatabaseError('Reason must be at least 10 characters', 400)
      }

      const interval = DURATION_MAP[requested_duration]
      if (!interval) {
        throw new DatabaseError(
          `Invalid duration. Valid options: ${Object.keys(DURATION_MAP).join(', ')}`,
          400
        )
      }

      // Check requester is admin+ in their org (or super_admin)
      if (!userContext.isSuperAdmin) {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', userContext.userId)
          .eq('organization_id', userContext.organizationId)
          .single()

        if (!membership || !['owner', 'admin'].includes(membership.role)) {
          throw new DatabaseError(
            'Only admins or owners can request cross-org access',
            403
          )
        }
      }

      // Verify target org exists
      const { data: targetOrg, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', target_org_id)
        .single()

      if (orgError || !targetOrg) {
        throw new DatabaseError('Target organization not found', 404)
      }

      // Prevent requesting access to own org
      if (target_org_id === userContext.organizationId) {
        throw new DatabaseError(
          'Cannot request access to your own organization',
          400
        )
      }

      // Check for existing pending request
      const { data: existingRequest } = await supabase
        .from('access_requests')
        .select('id, status')
        .eq('requester_id', userContext.userId)
        .eq('target_org_id', target_org_id)
        .eq('status', 'pending')
        .single()

      if (existingRequest) {
        throw new DatabaseError(
          'You already have a pending request for this organization',
          409
        )
      }

      // Check for active (approved, not expired) access
      const { data: activeAccess } = await supabase
        .from('access_requests')
        .select('id, expires_at')
        .eq('requester_id', userContext.userId)
        .eq('target_org_id', target_org_id)
        .eq('status', 'approved')
        .gt('expires_at', new Date().toISOString())
        .single()

      if (activeAccess) {
        throw new DatabaseError(
          'You already have active access to this organization',
          409
        )
      }

      // Create the access request
      const { data: request, error: createError } = await supabase
        .from('access_requests')
        .insert({
          requester_id: userContext.userId,
          requester_org_id: userContext.organizationId,
          target_org_id,
          reason,
          requested_duration: interval,
          status: 'pending',
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating access request:', createError)
        throw new DatabaseError('Failed to create access request', 500)
      }

      // Log to audit trail
      await supabase.from('user_audit_log').insert({
        user_id: userContext.userId,
        user_email: userContext.email,
        organization_id: userContext.organizationId,
        action_category: 'organization_management',
        action_type: 'cross_org_access_requested',
        resource_type: 'access_request',
        resource_id: request.id,
        resource_name: targetOrg.name,
        method: 'POST',
        endpoint: '/request-access',
        changes: {
          target_org_id,
          target_org_name: targetOrg.name,
          reason,
          requested_duration: interval,
        },
        status: 'success',
      })

      // Get target org owners for notification
      const { data: targetOwners } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', target_org_id)
        .eq('role', 'owner')

      // Get requester profile for notification
      const { data: requesterProfile } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', userContext.userId)
        .single()

      const requesterName = requesterProfile?.full_name || userContext.email

      // Send email notifications to target org owners
      if (targetOwners && targetOwners.length > 0) {
        try {
          const ownerUserIds = targetOwners.map((o) => o.user_id)

          // Use the existing send-notification edge function pattern
          // For now, log the notification intent — email integration uses Resend
          console.log(
            `[request-access] Notification: ${requesterName} requests ${interval} access to ${targetOrg.name}`,
            {
              ownerUserIds,
              requestId: request.id,
            }
          )
        } catch (notifyError) {
          // Don't fail the request if notification fails
          console.error('Failed to send notification:', notifyError)
        }
      }

      return createSuccessResponse(
        {
          request,
          target_org_name: targetOrg.name,
        },
        { status: 201, message: 'Access request created successfully' }
      )
    }

    // ─── GET: List Access Requests ──────────────────────────────────────
    if (method === 'GET') {
      const view = params.view || 'sent' // 'sent' | 'received' | 'all'
      const status = params.status // 'pending' | 'approved' | 'denied' | 'expired' | 'all'
      const orgId = params.organization_id

      let query = supabase
        .from('access_requests')
        .select(
          `
        *,
        requester:users!access_requests_requester_id_fkey(id, full_name, email, avatar_url),
        requester_org:organizations!access_requests_requester_org_id_fkey(id, name, slug),
        target_org:organizations!access_requests_target_org_id_fkey(id, name, slug),
        approver:users!access_requests_approved_by_fkey(id, full_name, email)
      `
        )
        .order('created_at', { ascending: false })

      if (view === 'sent') {
        // My outgoing requests
        query = query.eq('requester_id', userContext.userId)
      } else if (view === 'received') {
        // Requests targeting orgs I own/admin
        const resolvedOrgId =
          orgId || (await resolveOrganizationId(userContext, orgId))
        if (resolvedOrgId) {
          query = query.eq('target_org_id', resolvedOrgId)
        }
      } else if (view === 'all' && userContext.isSuperAdmin) {
        // Super admins can see everything
      } else {
        throw new DatabaseError('Invalid view parameter', 400)
      }

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      const { data: requests, error: listError } = await query

      if (listError) {
        console.error('Error listing access requests:', listError)
        throw new DatabaseError('Failed to fetch access requests', 500)
      }

      // Also run cleanup of expired requests while we're at it
      await supabase.rpc('cleanup_expired_access').catch(() => {
        // Non-critical, ignore errors
      })

      return createSuccessResponse({ requests: requests || [] })
    }

    // ─── PATCH: Approve or Deny Request ─────────────────────────────────
    if (method === 'PATCH') {
      const body = await getRequestBody<ApprovalBody>(req)
      const { request_id, action, denial_reason } = body

      if (!request_id || !action) {
        throw new DatabaseError('request_id and action are required', 400)
      }

      if (!['approve', 'deny'].includes(action)) {
        throw new DatabaseError('action must be "approve" or "deny"', 400)
      }

      // Get the request
      const { data: request, error: fetchError } = await supabase
        .from('access_requests')
        .select(
          '*, target_org:organizations!access_requests_target_org_id_fkey(id, name)'
        )
        .eq('id', request_id)
        .single()

      if (fetchError || !request) {
        throw new DatabaseError('Access request not found', 404)
      }

      if (request.status !== 'pending') {
        throw new DatabaseError(
          `Request has already been ${request.status}`,
          409
        )
      }

      // Verify approver is owner/admin of target org (or super_admin)
      if (!userContext.isSuperAdmin) {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', userContext.userId)
          .eq('organization_id', request.target_org_id)
          .single()

        if (!membership || !['owner', 'admin'].includes(membership.role)) {
          throw new DatabaseError(
            'Only target org owners/admins can approve or deny requests',
            403
          )
        }
      }

      if (action === 'approve') {
        // Calculate expiration
        const expiresAt = new Date()
        const durationMatch =
          request.requested_duration.match(/(\d+)\s*(hour|day)s?/)
        if (durationMatch) {
          const amount = parseInt(durationMatch[1])
          const unit = durationMatch[2]
          if (unit === 'hour') {
            expiresAt.setHours(expiresAt.getHours() + amount)
          } else if (unit === 'day') {
            expiresAt.setDate(expiresAt.getDate() + amount)
          }
        } else {
          // Default 4 hours
          expiresAt.setHours(expiresAt.getHours() + 4)
        }

        // Create temporary membership
        const { data: membership, error: memberError } = await supabase
          .from('organization_members')
          .insert({
            organization_id: request.target_org_id,
            user_id: request.requester_id,
            role: 'member', // Temporary access is always member-level
            is_temporary: true,
            expires_at: expiresAt.toISOString(),
            invited_by: userContext.userId,
          })
          .select()
          .single()

        if (memberError) {
          // If user already a member, that's fine
          if (memberError.code === '23505') {
            // unique_violation
            throw new DatabaseError(
              'User is already a member of this organization',
              409
            )
          }
          console.error('Error creating temporary membership:', memberError)
          throw new DatabaseError('Failed to create temporary membership', 500)
        }

        // Update request status
        const { error: updateError } = await supabase
          .from('access_requests')
          .update({
            status: 'approved',
            approved_by: userContext.userId,
            approved_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            granted_membership_id: membership.id,
          })
          .eq('id', request_id)

        if (updateError) {
          console.error('Error updating request:', updateError)
          throw new DatabaseError('Failed to update request status', 500)
        }

        // Audit log
        await supabase.from('user_audit_log').insert({
          user_id: userContext.userId,
          user_email: userContext.email,
          organization_id: request.target_org_id,
          action_category: 'organization_management',
          action_type: 'cross_org_access_approved',
          resource_type: 'access_request',
          resource_id: request_id,
          resource_name: request.target_org?.name,
          method: 'PATCH',
          endpoint: '/request-access',
          changes: {
            requester_id: request.requester_id,
            expires_at: expiresAt.toISOString(),
            membership_id: membership.id,
          },
          status: 'success',
        })

        return createSuccessResponse(
          {
            request_id,
            status: 'approved',
            expires_at: expiresAt.toISOString(),
            membership_id: membership.id,
          },
          { message: 'Access request approved. Temporary membership created.' }
        )
      } else {
        // Deny
        if (!denial_reason) {
          throw new DatabaseError(
            'denial_reason is required when denying a request',
            400
          )
        }

        const { error: updateError } = await supabase
          .from('access_requests')
          .update({
            status: 'denied',
            denied_by: userContext.userId,
            denied_at: new Date().toISOString(),
            denial_reason,
          })
          .eq('id', request_id)

        if (updateError) {
          console.error('Error updating request:', updateError)
          throw new DatabaseError('Failed to deny request', 500)
        }

        // Audit log
        await supabase.from('user_audit_log').insert({
          user_id: userContext.userId,
          user_email: userContext.email,
          organization_id: request.target_org_id,
          action_category: 'organization_management',
          action_type: 'cross_org_access_denied',
          resource_type: 'access_request',
          resource_id: request_id,
          resource_name: request.target_org?.name,
          method: 'PATCH',
          endpoint: '/request-access',
          changes: {
            requester_id: request.requester_id,
            denial_reason,
          },
          status: 'success',
        })

        return createSuccessResponse(
          {
            request_id,
            status: 'denied',
          },
          { message: 'Access request denied.' }
        )
      }
    }

    // ─── DELETE: Revoke or Cancel ───────────────────────────────────────
    if (method === 'DELETE') {
      const body = await getRequestBody<RevokeBody>(req)
      const { request_id } = body

      if (!request_id) {
        throw new DatabaseError('request_id is required', 400)
      }

      const { data: request, error: fetchError } = await supabase
        .from('access_requests')
        .select('*')
        .eq('id', request_id)
        .single()

      if (fetchError || !request) {
        throw new DatabaseError('Access request not found', 404)
      }

      // Requester can cancel their own pending request
      const isRequester = request.requester_id === userContext.userId
      // Target org owner/admin can revoke approved access
      let isTargetOrgAdmin = false
      if (!isRequester) {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', userContext.userId)
          .eq('organization_id', request.target_org_id)
          .single()
        isTargetOrgAdmin =
          !!membership && ['owner', 'admin'].includes(membership.role)
      }

      if (!isRequester && !isTargetOrgAdmin && !userContext.isSuperAdmin) {
        throw new DatabaseError(
          'Not authorized to cancel or revoke this request',
          403
        )
      }

      if (request.status === 'pending' && isRequester) {
        // Cancel pending request
        await supabase
          .from('access_requests')
          .update({ status: 'revoked' })
          .eq('id', request_id)

        return createSuccessResponse(
          { request_id, status: 'cancelled' },
          { message: 'Request cancelled.' }
        )
      }

      if (request.status === 'approved') {
        // Revoke active access - remove temporary membership
        if (request.granted_membership_id) {
          await supabase
            .from('organization_members')
            .delete()
            .eq('id', request.granted_membership_id)
        }

        await supabase
          .from('access_requests')
          .update({ status: 'revoked' })
          .eq('id', request_id)

        // Audit log
        await supabase.from('user_audit_log').insert({
          user_id: userContext.userId,
          user_email: userContext.email,
          organization_id: request.target_org_id,
          action_category: 'organization_management',
          action_type: 'cross_org_access_revoked',
          resource_type: 'access_request',
          resource_id: request_id,
          method: 'DELETE',
          endpoint: '/request-access',
          changes: {
            requester_id: request.requester_id,
            revoked_by: userContext.userId,
          },
          status: 'success',
        })

        return createSuccessResponse(
          { request_id, status: 'revoked' },
          { message: 'Access revoked and temporary membership removed.' }
        )
      }

      throw new DatabaseError(
        `Cannot revoke a request with status "${request.status}"`,
        400
      )
    }

    throw new DatabaseError('Method not allowed', 405)
  },
  {
    requireAuth: true,
    allowedMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
    logActivity: true,
  }
)
