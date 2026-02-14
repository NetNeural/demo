import { createEdgeFunction, createSuccessResponse, DatabaseError } from '../_shared/request-handler.ts'
import { getUserContext } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export default createEdgeFunction(async ({ req }) => {
  // Get authenticated user context
  const userContext = await getUserContext(req)
  
  // Create service_role client for bypassing RLS
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  // Only admins, owners, and super admins can email passwords
  if (!['super_admin', 'org_owner', 'org_admin'].includes(userContext.role)) {
    throw new DatabaseError('Insufficient permissions', 403)
  }

  if (req.method !== 'POST') {
    throw new Error('Method not allowed')
  }

  const body = await req.json()
  console.log('📥 Email password request received:', { 
    userId: body.userId,
    hasPassword: !!body.password,
  })
  
  const { userId, password } = body

  if (!userId || !password) {
    console.error('❌ Missing required fields:', { hasUserId: !!userId, hasPassword: !!password })
    throw new Error('userId and password are required')
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

  // Check if requester has permission
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
      throw new DatabaseError('You can only email passwords for users in your organization', 403)
    }

    // Check requester's role in the organization
    const { data: requesterMembership } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', userContext.organizationId)
      .eq('user_id', userContext.userId)
      .single()

    if (!requesterMembership) {
      throw new DatabaseError('You are not a member of this organization', 403)
    }

    // Only admins and owners can email passwords
    if (!['admin', 'owner'].includes(requesterMembership.role)) {
      throw new DatabaseError('Insufficient permissions', 403)
    }
  }

  // Send email notification to user (WITHOUT resetting password)
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  
  if (!resendApiKey) {
    throw new Error('Email service not configured')
  }

  try {
    console.log('📧 Sending password email...')
    
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NetNeural Platform <noreply@netneural.ai>',
        to: targetUser.email,
        subject: 'Your NetNeural Platform Password',
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
                .button { display: inline-block; background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>NetNeural Platform</h1>
                </div>
                <div class="content">
                  <h2>Your Password</h2>
                  <p>Hello ${targetUser.full_name || 'there'},</p>
                  <p>Here is your temporary password for the NetNeural Platform:</p>
                  
                  <div class="password-box">
                    ${password}
                  </div>
                  
                  <div class="warning">
                    <strong>⚠️ Important:</strong> This is a temporary password. For security reasons, you will be required to change it when you first log in.
                  </div>
                  
                  <div style="text-align: center;">
                    <a href="https://demo-stage.netneural.ai/auth/signin" class="button">Go to Login</a>
                  </div>
                  
                  <p><strong>Login Instructions:</strong></p>
                  <ol>
                    <li>Visit the login page using the button above</li>
                    <li>Enter your email: <strong>${targetUser.email}</strong></li>
                    <li>Use the temporary password shown above</li>
                    <li>You'll be prompted to create a new password</li>
                  </ol>
                  
                  <p>If you didn't request this password or have any questions, please contact your administrator.</p>
                </div>
                <div class="footer">
                  <p>This is an automated message from NetNeural Platform.</p>
                  <p>Please do not reply to this email.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      }),
    })

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json()
      console.error('❌ Resend API error:', errorData)
      
      // Return the error details instead of throwing
      return createSuccessResponse({
        success: false,
        message: 'Failed to send email',
        error: `Resend API error: ${errorData.message || 'Unknown error'}`,
        details: errorData,
      })
    }

    const emailData = await emailResponse.json()
    console.log('✅ Email sent successfully:', { emailId: emailData.id })
    
    return createSuccessResponse({
      message: 'Password email sent successfully',
      emailId: emailData.id,
    })
  } catch (error) {
    console.error('❌ Error sending email:', error)
    console.log('⚠️ Email error details:', error)
    
    // Return error details instead of throwing
    return createSuccessResponse({
      success: false,
      message: 'Failed to send email',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})
