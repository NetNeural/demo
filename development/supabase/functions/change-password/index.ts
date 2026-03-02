/**
 * Change Password Edge Function
 * 
 * Allows an authenticated user to change their own password.
 * Uses the admin API to bypass Supabase's "Secure password change" 
 * email confirmation requirement.
 * 
 * Flow:
 * 1. Verify the user is authenticated
 * 2. Verify the current password via Supabase Auth sign-in
 * 3. Update the password via admin API (always immediate)
 */

import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { getUserContext } from '../_shared/auth.ts'

export default createEdgeFunction(
  async ({ req }) => {
    // Get authenticated user context
    const userContext = await getUserContext(req)

    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    const body = await req.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      throw new Error('currentPassword and newPassword are required')
    }

    // Password validation
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters')
    }

    const hasUpperCase = /[A-Z]/.test(newPassword)
    const hasLowerCase = /[a-z]/.test(newPassword)
    const hasNumber = /[0-9]/.test(newPassword)
    const hasSpecialChar = /[^a-zA-Z0-9\s]/.test(newPassword)

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      throw new Error(
        'Password must contain uppercase, lowercase, number, and special character'
      )
    }

    if (currentPassword === newPassword) {
      throw new Error('New password must be different from current password')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Step 1: Verify current password by attempting sign-in via Auth API
    console.log('🔐 Verifying current password for user:', userContext.userId)

    const verifyResponse = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          email: userContext.email,
          password: currentPassword,
        }),
      }
    )

    if (!verifyResponse.ok) {
      console.error('❌ Current password verification failed')
      throw new DatabaseError('Current password is incorrect', 401)
    }

    console.log('✅ Current password verified')

    // Step 2: Update password using admin API (bypasses email confirmation)
    const updateResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${userContext.userId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          apikey: supabaseServiceKey,
        },
        body: JSON.stringify({
          password: newPassword,
        }),
      }
    )

    if (!updateResponse.ok) {
      const error = await updateResponse.json()
      console.error('❌ Password update failed:', error)
      throw new Error(error.message || 'Failed to update password')
    }

    console.log('✅ Password changed successfully for user:', userContext.userId)

    return createSuccessResponse({
      success: true,
      message: 'Password changed successfully',
    })
  },
  {
    allowedMethods: ['POST'],
  }
)
