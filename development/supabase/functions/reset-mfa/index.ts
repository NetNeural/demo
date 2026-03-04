/**
 * reset-mfa edge function
 * Allows admins/owners to unenroll all TOTP factors for a given user.
 * The user will be forced through MFA setup on their next login.
 */
import {
  createEdgeFunction,
  createSuccessResponse,
  handleEdgeFunctionError,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { getUserContext, createServiceClient } from '../_shared/auth.ts'

export default createEdgeFunction(
  async ({ req }) => {
    try {
      const userContext = await getUserContext(req)
      const supabaseAdmin = createServiceClient()

      const { targetUserId } = await req.json()

      if (!targetUserId) {
        throw new DatabaseError('targetUserId is required', 400)
      }

      // Permission check: must be super admin, or an owner/admin of an org that
      // contains the target user.
      if (!userContext.isSuperAdmin) {
        // Check that the calling user is an owner or admin of an org that the
        // target user belongs to.
        const { data: membership, error: memberError } = await supabaseAdmin
          .from('organization_members')
          .select('role, organization_id')
          .eq('user_id', userContext.userId)
          .in('role', ['owner', 'admin'])
          .limit(10)

        if (memberError || !membership || membership.length === 0) {
          throw new DatabaseError(
            'You do not have permission to reset MFA for this user',
            403
          )
        }

        // Check the target user is in one of those orgs
        const orgIds = membership.map((m: { organization_id: string }) => m.organization_id)
        const { data: targetMembership } = await supabaseAdmin
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', targetUserId)
          .in('organization_id', orgIds)
          .limit(1)

        if (!targetMembership || targetMembership.length === 0) {
          throw new DatabaseError(
            'You do not have permission to reset MFA for this user',
            403
          )
        }
      }

      // Use Supabase Auth Admin API to list and delete all TOTP factors
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      // List factors via Admin API
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
        const body = await listRes.text()
        throw new DatabaseError(`Failed to list MFA factors: ${body}`, 500)
      }

      const factors: Array<{ id: string; factor_type: string }> =
        await listRes.json()
      const totpFactors = factors.filter((f) => f.factor_type === 'totp')

      if (totpFactors.length === 0) {
        return createSuccessResponse({
          message: 'User has no MFA factors enrolled — nothing to reset.',
          removed: 0,
        })
      }

      // Delete each TOTP factor
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
        if (delRes.ok || delRes.status === 404) {
          removed++
        } else {
          const errBody = await delRes.text()
          console.error(`Failed to delete factor ${factor.id}:`, errBody)
        }
      }

      console.log(
        `[reset-mfa] Removed ${removed}/${totpFactors.length} TOTP factors for user ${targetUserId}`
      )

      return createSuccessResponse({
        message: `MFA has been reset. The user will be prompted to set up 2FA on their next login.`,
        removed,
      })
    } catch (error) {
      return handleEdgeFunctionError(error)
    }
  },
  {
    allowedMethods: ['POST'],
    requireAuth: true,
  }
)
