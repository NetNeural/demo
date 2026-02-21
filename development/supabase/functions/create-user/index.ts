import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { getUserContext, createAuthenticatedClient } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export default createEdgeFunction(
  async ({ req }) => {
    // Get authenticated user context
    const userContext = await getUserContext(req)

    // Create authenticated Supabase client for checking existing users
    const supabaseClient = createAuthenticatedClient(req)

    // Create service_role client for bypassing RLS when creating users
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Only admins, owners, and super admins can create users
    if (!['super_admin', 'org_owner', 'org_admin'].includes(userContext.role)) {
      throw new DatabaseError('Insufficient permissions to create users', 403)
    }

    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    const body = await req.json()
    console.log('📥 Create user request received:', {
      email: body.email,
      hasFullName: !!body.fullName,
      hasPassword: !!body.password,
      role: body.role,
      organizationRole: body.organizationRole,
      targetOrganizationId: body.organizationId,
    })

    const {
      email,
      fullName,
      password,
      role,
      organizationRole,
      organizationId: targetOrganizationId,
    } = body

    if (!email || !fullName || !password) {
      console.error('❌ Missing required fields:', {
        hasEmail: !!email,
        hasFullName: !!fullName,
        hasPassword: !!password,
      })
      throw new Error('email, fullName, and password are required')
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format')
    }

    // Password validation (min 6 characters)
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .eq('email', email)
      .single()

    let authUserId: string

    if (existingUser) {
      console.log('ℹ️ User already exists, checking organization membership...')

      // Use targetOrganizationId if provided, otherwise fall back to userContext.organizationId
      const checkOrgId = targetOrganizationId || userContext.organizationId

      // Check if user is already in the target organization
      const { data: existingMembership } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', checkOrgId)
        .eq('user_id', existingUser.id)
        .single()

      if (existingMembership) {
        throw new Error('User is already a member of this organization')
      }

      // User exists but not in this organization - reset their password and add them
      console.log(
        '✅ User exists but not in organization - resetting password and adding...'
      )

      authUserId = existingUser.id

      // Reset password using Admin API
      const resetResponse = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${authUserId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            apikey: supabaseServiceKey,
          },
          body: JSON.stringify({
            password: password,
            user_metadata: {
              full_name: fullName,
            },
          }),
        }
      )

      if (!resetResponse.ok) {
        const error = await resetResponse.json()
        throw new Error(error.message || 'Failed to reset user password')
      }

      console.log('✅ Password reset successfully')

      // Update users table to require password change
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          full_name: fullName,
          password_change_required: true,
        })
        .eq('id', authUserId)

      if (updateError) {
        console.error('Failed to update user record:', updateError)
        throw new DatabaseError(
          `Failed to update user record: ${updateError.message}`
        )
      }

      console.log('✅ User record updated with password_change_required flag')
    } else {
      // User doesn't exist - create new user
      console.log('✅ Creating new user...')

      // Create user in auth.users using Supabase admin API
      if (!supabaseServiceKey) {
        throw new Error('Missing service role key')
      }

      // Create auth user
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          apikey: supabaseServiceKey,
        },
        body: JSON.stringify({
          email: email,
          password: password,
          email_confirmed_at: new Date().toISOString(), // Explicitly confirm email immediately
          user_metadata: {
            full_name: fullName,
          },
        }),
      })

      if (!authResponse.ok) {
        const error = await authResponse.json()
        throw new Error(error.message || 'Failed to create auth user')
      }

      const authUser = await authResponse.json()
      authUserId = authUser.id

      // Create user in public.users table using admin client (bypasses RLS)
      // @ts-expect-error - Insert object not fully typed in generated types
      const { data: newUser, error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUserId,
          email: email,
          full_name: fullName,
          role: role || 'user',
          organization_id: userContext.organizationId, // Assign to admin's organization
          password_change_required: true, // User must change password on first login
        })
        .select()
        .single()

      if (userError) {
        console.error('Failed to create user record:', userError)
        throw new DatabaseError(
          `Failed to create user record: ${userError.message}`
        )
      }

      console.log('✅ User record created with password_change_required flag')
    }

    // Send welcome email with temporary password
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (resendApiKey) {
      try {
        console.log('📧 Sending welcome email with temporary password...')

        // Fetch organization subscription tier if available
        let subscriptionTier = 'Starter'
        let deviceLimit = '50'
        
        if (targetOrganizationId) {
          const { data: orgData } = await supabaseAdmin
            .from('organizations')
            .select('subscription_tier')
            .eq('id', targetOrganizationId)
            .single()
          
          if (orgData?.subscription_tier) {
            subscriptionTier = orgData.subscription_tier.charAt(0).toUpperCase() + orgData.subscription_tier.slice(1)
            const tierLimits: Record<string, string> = {
              'free': '5',
              'starter': '50',
              'professional': '500',
              'enterprise': 'Unlimited'
            }
            deviceLimit = tierLimits[orgData.subscription_tier] || '50'
          }
        }

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'NetNeural Platform <noreply@netneural.ai>',
            to: email,
            subject: 'Welcome to NetNeural IoT Platform',
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
                  .password-box { background: white; border: 2px solid #e0e0e0; padding: 15px; margin: 20px 0; font-family: monospace; font-size: 18px; text-align: center; letter-spacing: 2px; word-break: break-all; user-select: all; }
                  .copy-hint { font-size: 12px; color: #666; margin-top: 8px; font-style: italic; }
                  .account-info { background: #e8f4f8; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; border-radius: 4px; }
                  .account-info strong { color: #0066cc; }
                  .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                  .cta-button { display: inline-block; background: #1a1a1a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                  .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>Welcome to NetNeural</h1>
                  </div>
                  <div class="content">
                    <h2>Your Account is Ready!</h2>
                    <p>Hello ${fullName},</p>
                    <p>An account has been created for you on the NetNeural IoT Platform. Here are your login credentials:</p>
                    
                    <p><strong>Email:</strong> ${email}</p>
                    
                    <p><strong>Temporary Password:</strong></p>
                    <div class="password-box">
                      ${password}
                    </div>
                    <div class="copy-hint">💡 Tip: Click and drag or triple-click to select, then use Ctrl+C (or Cmd+C on Mac) to copy</div>
                    
                    <div class="account-info">
                      <p><strong>Your Account Tier:</strong> ${subscriptionTier}</p>
                      <p><strong>Device Limit:</strong> Up to ${deviceLimit} devices</p>
                    </div>
                    
                    <div class="warning">
                      <strong>⚠️ Important:</strong> You will be required to change this password when you log in for the first time.
                    </div>
                    
                    <p style="text-align: center;">
                      <a href="https://demo-stage.netneural.ai" class="cta-button">Log In Now</a>
                    </p>
                    
                    <h3>What's Next?</h3>
                    <ol>
                      <li>Click the button above to access the platform</li>
                      <li>Log in with your email and temporary password</li>
                      <li>Create a new secure password</li>
                      <li>Start managing your IoT devices!</li>
                    </ol>
                    
                    <p>If you have any questions, please contact your system administrator.</p>
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
          console.error('Failed to send welcome email:', error)
          // Don't throw - user still created successfully
        } else {
          console.log('✅ Welcome email sent successfully')
        }
      } catch (error) {
        console.error('Error sending email:', error)
        // Don't throw - user still created successfully
      }
    } else {
      console.warn('⚠️ RESEND_API_KEY not configured - skipping email')
    }

    // Create organization membership
    // Use targetOrganizationId if provided, otherwise fall back to userContext.organizationId
    const membershipOrgId = targetOrganizationId || userContext.organizationId

    if (membershipOrgId) {
      // Use organizationRole from request, default to 'member'
      const memberRole = organizationRole || 'member'
      console.log('🏭 Creating organization membership:', {
        targetOrganizationId: membershipOrgId,
        memberRole,
        wasExplicitlyProvided: !!targetOrganizationId,
      })

      // @ts-expect-error - Insert object not fully typed in generated types
      const { error: memberError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          organization_id: membershipOrgId,
          user_id: authUserId,
          role: memberRole,
          permissions: {},
        })

      if (memberError) {
        console.error('Failed to create organization membership:', memberError)
        // Don't fail the whole operation, just log the error
      } else {
        console.log(
          '✅ Organization membership created with role:',
          memberRole,
          'in organization:',
          membershipOrgId
        )
      }
    }

    console.log('✅ User created/updated successfully:', {
      userId: authUserId,
      email: body.email,
      addedToOrganization: !!userContext.organizationId,
    })

    return createSuccessResponse(
      {
        user: {
          id: authUserId,
          email: email,
          fullName: fullName,
          role: role || 'user',
        },
      },
      { status: 201 }
    )
  },
  {
    allowedMethods: ['POST'],
  }
)
