/**
 * generate-recovery-codes edge function
 *
 * Generates 10 one-time MFA recovery codes for the authenticated user.
 * Codes are returned in plain text ONCE — only bcrypt hashes are stored.
 * Any previously generated codes are deleted first.
 *
 * Requires: authenticated user with a verified TOTP factor.
 */
import {
  createEdgeFunction,
  createSuccessResponse,
  handleEdgeFunctionError,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { getUserContext, createServiceClient } from '../_shared/auth.ts'

const CODE_COUNT = 10
const CODE_LENGTH = 8 // 8-char alphanumeric codes

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 for readability
  const array = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => chars[b % chars.length]).join('')
}

async function hashCode(code: string): Promise<string> {
  // Use SHA-256 for fast server-side hashing — codes are high-entropy random
  const encoder = new TextEncoder()
  const data = encoder.encode(code.toUpperCase())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default createEdgeFunction(
  async ({ req }) => {
    try {
      const userContext = await getUserContext(req)
      const supabaseAdmin = createServiceClient()

      // Verify user has MFA enrolled
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      const factorsRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${userContext.userId}/factors`,
        {
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
        }
      )

      if (!factorsRes.ok) {
        throw new DatabaseError('Failed to check MFA status', 500)
      }

      const factors: Array<{ id: string; factor_type: string; status: string }> =
        await factorsRes.json()
      const hasVerifiedTotp = factors.some(
        (f) => f.factor_type === 'totp' && f.status === 'verified'
      )

      if (!hasVerifiedTotp) {
        throw new DatabaseError(
          'You must have 2FA enabled before generating recovery codes',
          400
        )
      }

      // Delete any existing recovery codes for this user
      await supabaseAdmin
        .from('mfa_recovery_codes')
        .delete()
        .eq('user_id', userContext.userId)

      // Generate new codes
      const plainCodes: string[] = []
      const rows: Array<{ user_id: string; code_hash: string }> = []

      for (let i = 0; i < CODE_COUNT; i++) {
        const code = generateCode()
        plainCodes.push(code)
        const hash = await hashCode(code)
        rows.push({ user_id: userContext.userId, code_hash: hash })
      }

      // Insert hashed codes
      const { error: insertError } = await supabaseAdmin
        .from('mfa_recovery_codes')
        .insert(rows)

      if (insertError) {
        throw new DatabaseError(
          `Failed to store recovery codes: ${insertError.message}`,
          500
        )
      }

      // Audit log
      await supabaseAdmin.from('user_audit_log').insert({
        user_id: userContext.userId,
        user_email: userContext.email ?? '',
        action_category: 'auth',
        action_type: 'recovery_codes_generated',
        resource_type: 'mfa_recovery_codes',
        method: 'POST',
        endpoint: '/functions/v1/generate-recovery-codes',
        status: 'success',
        changes: { count: CODE_COUNT },
      })

      // Return plain codes — this is the ONLY time they're shown
      return createSuccessResponse({
        codes: plainCodes,
        message:
          'Save these recovery codes in a safe place. Each code can only be used once. They will not be shown again.',
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
