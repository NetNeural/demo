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

    // Create service_role client for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Only admins, owners, and super admins can reset passwords
    if (!['super_admin', 'org_owner', 'org_admin'].includes(userContext.role)) {
      throw new DatabaseError(
        'Insufficient permissions to reset passwords',
        403
      )
    }

    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    const body = await req.json()
    console.log('📥 Reset password request received:', {
      userId: body.userId,
      hasPassword: !!body.password,
    })

    const { userId, password } = body

    if (!userId || !password) {
      console.error('❌ Missing required fields:', {
        hasUserId: !!userId,
        hasPassword: !!password,
      })
      throw new Error('userId and password are required')
    }

    // Password validation (min 6 characters)
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    // Verify the target user exists
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, organization_id')
      .eq('id', userId)
      .single()

    if (userError || !targetUser) {
      throw new DatabaseError('User not found', 404)
    }

    console.log('✅ Target user found:', { userId, email: targetUser.email })

    // Check if requester has permission to reset this user's password
    const isSuperAdmin = userContext.role === 'super_admin'

    if (!isSuperAdmin) {
      // Check if target user is in the same organization
      const { data: membership } = await supabaseAdmin
        .from('organization_members')
        .select('role')
        .eq('organization_id', userContext.organizationId)
        .eq('user_id', userId)
        .maybeSingle()

      if (!membership) {
        throw new DatabaseError(
          'You can only reset passwords for users in your organization',
          403
        )
      }

      // Check requester's role in the organization
      const { data: requesterMembership } = await supabaseAdmin
        .from('organization_members')
        .select('role')
        .eq('organization_id', userContext.organizationId)
        .eq('user_id', userContext.userId)
        .single()

      if (!requesterMembership) {
        throw new DatabaseError(
          'You are not a member of this organization',
          403
        )
      }

      // Only admins and owners can reset passwords
      if (!['admin', 'owner'].includes(requesterMembership.role)) {
        throw new DatabaseError('Insufficient permissions', 403)
      }
    }

    // Reset password using Supabase Admin API
    const resetResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${userId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          apikey: supabaseServiceKey,
        },
        body: JSON.stringify({
          password: password,
        }),
      }
    )

    if (!resetResponse.ok) {
      const error = await resetResponse.json()
      throw new Error(error.message || 'Failed to reset password')
    }

    console.log('✅ Password reset successfully in auth system')

    // Update users table to require password change
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        password_change_required: true,
      })
      .eq('id', userId)

    if (updateError) {
      console.error(
        'Failed to update password_change_required flag:',
        updateError
      )
      throw new DatabaseError(
        `Failed to update user record: ${updateError.message}`
      )
    }

    console.log('✅ Password change required flag set')

    // Send email notification to user
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (resendApiKey) {
      try {
        console.log('📧 Sending password reset email...')

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'NetNeural Platform <noreply@netneural.ai>',
            to: targetUser.email,
            subject: 'Your Password Has Been Reset',
            html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; }
                  .content { background: #f9f9f9; padding: 30px; border-radius: 5px; margin: 20px 0; }
                  .password-box { background: white; border: 2px solid #e0e0e0; padding: 15px; margin: 20px 0; font-family: monospace; font-size: 18px; text-align: center; letter-spacing: 2px; }
                  .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                  .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>NetNeural IoT Platform</h1>
                  </div>
                  <div class="content">
                    <h2>Password Reset</h2>
                    <p>Hello ${targetUser.full_name || 'there'},</p>
                    <p>Your password has been reset by an administrator. Here is your new temporary password:</p>
                    
                    <div class="password-box">
                      ${password}
                    </div>
                    
                    <div class="warning">
                      <strong>⚠️ Important:</strong> You will be required to change this password when you log in for the first time.
                    </div>
                    
                    <p>To log in:</p>
                    <ol>
                      <li>Go to <a href="https://demo-stage.netneural.ai">https://demo-stage.netneural.ai</a></li>
                      <li>Enter your email: <strong>${targetUser.email}</strong></li>
                      <li>Enter the temporary password above</li>
                      <li>You'll be prompted to create a new password</li>
                    </ol>
                    
                    <p>If you did not request this password reset, please contact your system administrator immediately.</p>
                  </div>
                  <div class="footer">
                    <p>NetNeural IoT Platform - Secure Device Management</p>
                    <p>This is an automated message, please do not reply.</p>
                  </div>
                </div>
              </body>
            </html>
          `,
          }),
        })

        if (!emailResponse.ok) {
          const error = await emailResponse.json()
          console.error('Failed to send password reset email:', error)
          console.log('📧 Email service returned error:', {
            status: emailResponse.status,
            message: error.message,
            details: error,
          })
          // Don't throw - password still reset successfully in auth
        } else {
          console.log('✅ Password reset email sent successfully')
        }
      } catch (error) {
        console.error('Error sending email:', error)
        // Don't throw - password still reset successfully
      }
    } else {
      console.warn('⚠️ RESEND_API_KEY not configured - skipping email')
    }

    return createSuccessResponse({
      success: true,
      message: 'Password reset successfully',
    })
  },
  {
    allowedMethods: ['POST'],
  }
)
