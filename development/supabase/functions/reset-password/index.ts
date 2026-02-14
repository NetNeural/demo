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

  // Only admins, owners, and super admins can reset passwords
  if (!['super_admin', 'org_owner', 'org_admin'].includes(userContext.role)) {
    throw new DatabaseError('Insufficient permissions to reset passwords', 403)
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
    console.error('❌ Missing required fields:', { hasUserId: !!userId, hasPassword: !!password })
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
      throw new DatabaseError('You can only reset passwords for users in your organization', 403)
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

    // Only admins and owners can reset passwords
    if (!['admin', 'owner'].includes(requesterMembership.role)) {
      throw new DatabaseError('Insufficient permissions', 403)
    }
  }

  // Reset password using Supabase Admin API
  const resetResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
    },
    body: JSON.stringify({
      password: password,
    }),
  })

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
    console.error('Failed to update password_change_required flag:', updateError)
    throw new DatabaseError(`Failed to update user record: ${updateError.message}`)
  }

  console.log('✅ Password change required flag set')

  // TODO: Send email notification to user
  // This requires configuring email templates in Supabase dashboard
  // or using a service like Resend/SendGrid

  return createSuccessResponse({ 
    success: true,
    message: 'Password reset successfully',
  })
}, {
  allowedMethods: ['POST']
})
