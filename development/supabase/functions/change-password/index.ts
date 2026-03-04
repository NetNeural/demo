/**
 * Change Password Edge Function
 * 
 * Allows an authenticated user to change their own password.
 * Uses the admin API to bypass Supabase's "Secure password change" 
 * email confirmation requirement.
 * 
 * Supports two modes:
 * 1. Normal: currentPassword + newPassword (Settings > Security)
 * 2. Force:  newPassword only, when password_change_required = true
 *            (temp password flow after first login)
 */

import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { getUserContext } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export default createEdgeFunction(
  async ({ req }) => {
    // Get authenticated user context
    const userContext = await getUserContext(req)

    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    const body = await req.json()
    const { currentPassword, newPassword, forceChange } = body

    if (!newPassword) {
      throw new Error('newPassword is required')
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    if (forceChange) {
      // Force-change mode: skip current password, but ONLY if
      // the user's password_change_required flag is actually true.
      // This prevents abuse — only temp-password users can use this path.
      console.log('🔐 Force-change mode for user:', userContext.userId)

      const { data: userRecord, error: lookupError } = await supabaseAdmin
        .from('users')
        .select('password_change_required')
        .eq('id', userContext.userId)
        .single()

      if (lookupError || !userRecord) {
        throw new DatabaseError('User record not found', 404)
      }

      if (!userRecord.password_change_required) {
        throw new DatabaseError(
          'Force-change is only allowed for temporary password users',
          403
        )
      }
    } else {
      // Normal mode: verify current password first
      if (!currentPassword) {
        throw new Error('currentPassword is required')
      }

      if (currentPassword === newPassword) {
        throw new Error('New password must be different from current password')
      }

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
    }

    // Update password using admin API (bypasses email confirmation)
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

    // Clear the password_change_required flag
    const { error: clearError } = await supabaseAdmin
      .from('users')
      .update({ password_change_required: false })
      .eq('id', userContext.userId)

    if (clearError) {
      console.error('Failed to clear password_change_required:', clearError)
      // Don't fail — password was already changed successfully
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
