/**
 * verify-recovery-code edge function
 *
 * Verifies a one-time recovery code to bypass MFA when the authenticator
 * app is unavailable. On success, removes all TOTP factors so the user
 * is signed in without MFA and can re-enroll later.
 *
 * Requires: user to be at AAL1 (password authenticated but not MFA-verified).
 * The caller must pass their own JWT (aal1) + the recovery code.
 */
import {
  createEdgeFunction,
  createSuccessResponse,
  handleEdgeFunctionError,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createServiceClient } from '../_shared/auth.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(code.toUpperCase())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default createEdgeFunction(
  async ({ req }) => {
    try {
      // Extract user from JWT (aal1 — password-only session)
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        throw new DatabaseError('Missing authorization', 401)
      }
      const token = authHeader.replace('Bearer ', '')

      // Create a client with the user's token to identify them
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      })

      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser()

      if (userError || !user) {
        throw new DatabaseError('Invalid or expired session', 401)
      }

      const { code } = await req.json()
      if (!code || typeof code !== 'string') {
        throw new DatabaseError('Recovery code is required', 400)
      }

      const supabaseAdmin = createServiceClient()
      const codeHash = await hashCode(code.trim())

      // Find matching unused code
      const { data: matchingCode, error: lookupError } = await supabaseAdmin
        .from('mfa_recovery_codes')
        .select('id')
        .eq('user_id', user.id)
        .eq('code_hash', codeHash)
        .is('used_at', null)
        .limit(1)
        .single()

      if (lookupError || !matchingCode) {
        // Audit failed attempt
        await supabaseAdmin.from('user_audit_log').insert({
          user_id: user.id,
          user_email: user.email ?? '',
          action_category: 'auth',
          action_type: 'recovery_code_failed',
          resource_type: 'mfa_recovery_codes',
          method: 'POST',
          endpoint: '/functions/v1/verify-recovery-code',
          status: 'error',
          changes: { reason: 'invalid_code' },
        })
        throw new DatabaseError('Invalid or already-used recovery code', 400)
      }

      // Mark code as used
      await supabaseAdmin
        .from('mfa_recovery_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('id', matchingCode.id)

      // Remove all TOTP factors so the user bypasses MFA
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      const factorsRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${user.id}/factors`,
        {
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
        }
      )

      if (factorsRes.ok) {
        const factors: Array<{ id: string; factor_type: string }> =
          await factorsRes.json()
        for (const factor of factors.filter((f) => f.factor_type === 'totp')) {
          await fetch(
            `${supabaseUrl}/auth/v1/admin/factors/${factor.id}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                apikey: serviceKey,
              },
            }
          )
        }
      }

      // Delete ALL recovery codes for this user (they need to regenerate after re-enrolling MFA)
      await supabaseAdmin
        .from('mfa_recovery_codes')
        .delete()
        .eq('user_id', user.id)

      // Audit success
      await supabaseAdmin.from('user_audit_log').insert({
        user_id: user.id,
        user_email: user.email ?? '',
        action_category: 'auth',
        action_type: 'recovery_code_used',
        resource_type: 'mfa_recovery_codes',
        method: 'POST',
        endpoint: '/functions/v1/verify-recovery-code',
        status: 'success',
        changes: { mfa_factors_removed: true },
      })

      return createSuccessResponse({
        message:
          'Recovery code accepted. MFA has been disabled. You can re-enable it from Settings.',
        mfaDisabled: true,
      })
    } catch (error) {
      return handleEdgeFunctionError(error)
    }
  },
  {
    allowedMethods: ['POST'],
    requireAuth: false, // User is at AAL1, not fully authenticated
  }
)
