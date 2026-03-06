// deno-lint-ignore-file
/// <reference lib="deno.window" />
/**
 * user-support edge function
 * Tier 1/2 support actions for NetNeural admins:
 *   - List users across eligible sub-orgs (direct children + reseller children with support_model != 'self')
 *   - Reset password for a user
 *   - Change email for a user
 *   - Reset MFA for a user
 *
 * Access: NetNeural platform admins only (super_admin, platform_admin, or admin/owner of NetNeural org)
 */
import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { getUserContext, createServiceClient } from '../_shared/auth.ts'

const NETNEURAL_ORG_ID = '00000000-0000-0000-0000-000000000001'

export default createEdgeFunction(async ({ req }) => {
  const userContext = await getUserContext(req)
  const supabaseAdmin = createServiceClient()

  // Gate: must be NetNeural admin or above
  const isNetNeuralAdmin = await checkNetNeuralAdmin(
    supabaseAdmin,
    userContext.userId,
    userContext.isSuperAdmin
  )
  if (!isNetNeuralAdmin) {
    throw new DatabaseError(
      'Only NetNeural administrators can access user support tools',
      403
    )
  }

  const url = new URL(req.url)

  // GET  — list eligible orgs and their users
  // POST — perform a support action
  if (req.method === 'GET') {
    return await handleListUsers(supabaseAdmin, url)
  }

  if (req.method === 'POST') {
    const body = await req.json()
    return await handleSupportAction(supabaseAdmin, userContext, body)
  }

  throw new DatabaseError('Method not allowed', 405)
})

/** Check if the calling user is admin+ in the NetNeural org */
async function checkNetNeuralAdmin(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  userId: string,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return true

  const { data: membership } = await supabaseAdmin
    .from('organization_members')
    .select('role')
    .eq('organization_id', NETNEURAL_ORG_ID)
    .eq('user_id', userId)
    .maybeSingle()

  return membership && ['owner', 'admin'].includes(membership.role)
}

/**
 * Get all orgs that NetNeural can provide support for:
 *  - Direct sub-orgs (parent_organization_id = NetNeural)
 *  - Reseller sub-orgs where the reseller's support_model is 'netneural' or 'hybrid'
 */
// deno-lint-ignore no-explicit-any
async function getEligibleOrgIds(supabaseAdmin: any): Promise<string[]> {
  // 1. Direct child orgs of NetNeural
  const { data: directChildren } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('parent_organization_id', NETNEURAL_ORG_ID)

  const directIds = (directChildren || []).map(
    (o: { id: string }) => o.id
  )

  // 2. Reseller orgs (direct children that are resellers)
  const { data: resellers } = await supabaseAdmin
    .from('organizations')
    .select('id, support_model')
    .eq('parent_organization_id', NETNEURAL_ORG_ID)
    .eq('is_reseller', true)

  // 3. For resellers with support_model != 'self', include their child orgs
  const resellerChildIds: string[] = []
  for (const reseller of resellers || []) {
    if (reseller.support_model === 'self') continue
    const { data: resellerChildren } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('parent_organization_id', reseller.id)

    for (const child of resellerChildren || []) {
      resellerChildIds.push(child.id)
    }
  }

  // Combine and deduplicate
  const allIds = [...new Set([...directIds, ...resellerChildIds])]
  return allIds
}

/** GET: List users across eligible orgs */
// deno-lint-ignore no-explicit-any
async function handleListUsers(supabaseAdmin: any, url: URL) {
  const orgFilter = url.searchParams.get('organization_id')
  const search = url.searchParams.get('search')

  const eligibleIds = await getEligibleOrgIds(supabaseAdmin)

  // If filtering by a specific org, validate it's in the eligible list
  if (orgFilter && !eligibleIds.includes(orgFilter)) {
    throw new DatabaseError(
      'Organization is not eligible for NetNeural support',
      403
    )
  }

  const targetOrgIds = orgFilter ? [orgFilter] : eligibleIds

  if (targetOrgIds.length === 0) {
    return createSuccessResponse({ organizations: [], users: [] })
  }

  // Fetch org info for the sidebar/filter
  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select(
      'id, name, slug, subscription_tier, parent_organization_id, support_model'
    )
    .in('id', eligibleIds)
    .order('name')

  // Fetch members with org info
  let membersQuery = supabaseAdmin
    .from('organization_members')
    .select(
      `
      id,
      role,
      user_id,
      organization_id,
      joined_at,
      users!inner (
        id,
        email,
        full_name,
        role,
        is_active,
        last_sign_in_at,
        password_change_required,
        locked_until,
        failed_login_attempts
      )
    `
    )
    .in('organization_id', targetOrgIds)
    .order('organization_id')

  if (search) {
    membersQuery = membersQuery.or(
      `users.email.ilike.%${search}%,users.full_name.ilike.%${search}%`
    )
  }

  const { data: members, error: membersError } = await membersQuery

  if (membersError) {
    console.error('Error fetching members:', membersError)
    throw new DatabaseError(
      `Failed to fetch members: ${membersError.message}`
    )
  }

  // Check MFA status for each user (batch)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // deno-lint-ignore no-explicit-any
  const userIds: string[] = [...new Set((members || []).map((m: any) => m.user_id))]
  const mfaStatusMap: Record<string, boolean> = {}

  // Batch check MFA factors (limit concurrent requests)
  const batchSize = 10
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(async (uid) => {
        try {
          const res = await fetch(
            `${supabaseUrl}/auth/v1/admin/users/${uid}/factors`,
            {
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                apikey: serviceKey,
              },
            }
          )
          if (res.ok) {
            const factors: Array<{ factor_type: string; status: string }> =
              await res.json()
            return {
              uid,
              hasMfa: factors.some(
                (f) => f.factor_type === 'totp' && f.status === 'verified'
              ),
            }
          }
        } catch {
          // ignore
        }
        return { uid, hasMfa: false }
      })
    )
    for (const r of results) {
      mfaStatusMap[r.uid] = r.hasMfa
    }
  }

  // deno-lint-ignore no-explicit-any
  const users = (members || []).map((m: any) => ({
    membershipId: m.id,
    memberRole: m.role,
    organizationId: m.organization_id,
    joinedAt: m.joined_at,
    userId: m.users.id,
    email: m.users.email,
    fullName: m.users.full_name,
    globalRole: m.users.role,
    isActive: m.users.is_active,
    lastSignIn: m.users.last_sign_in_at,
    passwordChangeRequired: m.users.password_change_required,
    lockedUntil: m.users.locked_until,
    failedLoginAttempts: m.users.failed_login_attempts,
    hasMfa: mfaStatusMap[m.users.id] || false,
  }))

  return createSuccessResponse({ organizations: orgs || [], users })
}

/** POST: Perform a support action */
async function handleSupportAction(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  userContext: { userId: string; email: string },
  body: {
    action: 'reset-password' | 'change-email' | 'reset-mfa' | 'unlock-account'
    targetUserId: string
    password?: string
    newEmail?: string
  }
) {
  const { action, targetUserId, password, newEmail } = body

  if (!action || !targetUserId) {
    throw new DatabaseError('action and targetUserId are required', 400)
  }

  // Verify target user is in an eligible org
  const eligibleIds = await getEligibleOrgIds(supabaseAdmin)
  const { data: targetMembership } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', targetUserId)
    .in('organization_id', eligibleIds)
    .limit(1)
    .maybeSingle()

  if (!targetMembership) {
    throw new DatabaseError(
      'Target user is not in an organization eligible for NetNeural support',
      403
    )
  }

  // Get target user info for audit logging
  const { data: targetUser } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name')
    .eq('id', targetUserId)
    .single()

  if (!targetUser) {
    throw new DatabaseError('Target user not found', 404)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  switch (action) {
    case 'reset-password': {
      if (!password || password.length < 6) {
        throw new DatabaseError(
          'Password is required and must be at least 6 characters',
          400
        )
      }

      const res = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${targetUserId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            apikey: serviceKey,
          },
          body: JSON.stringify({
            password,
            email_confirm: true,
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json()
        throw new DatabaseError(
          err.message || 'Failed to reset password',
          500
        )
      }

      // Set password_change_required flag
      await supabaseAdmin
        .from('users')
        .update({ password_change_required: true })
        .eq('id', targetUserId)

      await logSupportAction(supabaseAdmin, {
        performedBy: userContext.userId,
        targetUserId,
        action: 'password_reset',
        targetEmail: targetUser.email,
      })

      return createSuccessResponse({
        message: `Password reset for ${targetUser.email}. User will be prompted to change on next login.`,
      })
    }

    case 'change-email': {
      if (!newEmail || !newEmail.includes('@')) {
        throw new DatabaseError('A valid email address is required', 400)
      }

      const res = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${targetUserId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            apikey: serviceKey,
          },
          body: JSON.stringify({
            email: newEmail,
            email_confirm: true,
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json()
        throw new DatabaseError(
          err.message || 'Failed to change email',
          500
        )
      }

      // Also update public.users email
      await supabaseAdmin
        .from('users')
        .update({ email: newEmail })
        .eq('id', targetUserId)

      await logSupportAction(supabaseAdmin, {
        performedBy: userContext.userId,
        targetUserId,
        action: 'email_change',
        targetEmail: targetUser.email,
        metadata: { oldEmail: targetUser.email, newEmail },
      })

      return createSuccessResponse({
        message: `Email changed from ${targetUser.email} to ${newEmail}`,
      })
    }

    case 'reset-mfa': {
      // List and delete all TOTP factors
      const listRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${targetUserId}/factors`,
        {
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
        }
      )

      if (!listRes.ok) {
        throw new DatabaseError('Failed to list MFA factors', 500)
      }

      const factors: Array<{ id: string; factor_type: string }> =
        await listRes.json()
      const totpFactors = factors.filter((f) => f.factor_type === 'totp')

      if (totpFactors.length === 0) {
        return createSuccessResponse({
          message: 'User has no MFA factors enrolled.',
          removed: 0,
        })
      }

      let removed = 0
      for (const factor of totpFactors) {
        const delRes = await fetch(
          `${supabaseUrl}/auth/v1/admin/factors/${factor.id}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              apikey: serviceKey,
            },
          }
        )
        if (delRes.ok) removed++
      }

      await logSupportAction(supabaseAdmin, {
        performedBy: userContext.userId,
        targetUserId,
        action: 'mfa_reset',
        targetEmail: targetUser.email,
        metadata: { factorsRemoved: removed },
      })

      return createSuccessResponse({
        message: `MFA reset for ${targetUser.email}. ${removed} factor(s) removed.`,
        removed,
      })
    }

    case 'unlock-account': {
      await supabaseAdmin
        .from('users')
        .update({
          locked_until: null,
          failed_login_attempts: 0,
        })
        .eq('id', targetUserId)

      await logSupportAction(supabaseAdmin, {
        performedBy: userContext.userId,
        targetUserId,
        action: 'account_unlock',
        targetEmail: targetUser.email,
      })

      return createSuccessResponse({
        message: `Account unlocked for ${targetUser.email}`,
      })
    }

    default:
      throw new DatabaseError(`Unknown action: ${action}`, 400)
  }
}

/** Log support action to user_audit_log */
async function logSupportAction(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  params: {
    performedBy: string
    targetUserId: string
    action: string
    targetEmail: string
    metadata?: Record<string, unknown>
  }
) {
  try {
    await supabaseAdmin.from('user_audit_log').insert({
      user_id: params.performedBy,
      action_category: 'support',
      action_type: `support.${params.action}`,
      resource_type: 'user',
      resource_id: params.targetUserId,
      resource_name: params.targetEmail,
      status: 'success',
      metadata: {
        ...params.metadata,
        targetUserId: params.targetUserId,
        targetEmail: params.targetEmail,
      },
    })
  } catch (e) {
    console.error('Failed to log support action:', e)
  }
}
