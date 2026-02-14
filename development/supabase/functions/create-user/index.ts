import { createEdgeFunction, createSuccessResponse, DatabaseError } from '../_shared/request-handler.ts'
import { 
  getUserContext, 
  createAuthenticatedClient
} from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export default createEdgeFunction(async ({ req }) => {
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
    organizationRole: body.organizationRole 
  })
  
  const { email, fullName, password, role, organizationRole } = body

  if (!email || !fullName || !password) {
    console.error('❌ Missing required fields:', { hasEmail: !!email, hasFullName: !!fullName, hasPassword: !!password })
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
    
    // Check if user is already in the organization
    const { data: existingMembership } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', userContext.organizationId)
      .eq('user_id', existingUser.id)
      .single()

    if (existingMembership) {
      throw new Error('User is already a member of this organization')
    }

    // User exists but not in this organization - reset their password and add them
    console.log('✅ User exists but not in organization - resetting password and adding...')
    
    authUserId = existingUser.id

    // Reset password using Admin API
    const resetResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
      },
      body: JSON.stringify({
        password: password,
        user_metadata: {
          full_name: fullName,
        },
      }),
    })

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
      throw new DatabaseError(`Failed to update user record: ${updateError.message}`)
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
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
      },
      body: JSON.stringify({
        email: email,
        password: password,
        email_confirm: true, // Auto-confirm email for admin-created users
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
      throw new DatabaseError(`Failed to create user record: ${userError.message}`)
    }
    
    console.log('✅ User record created with password_change_required flag')
  }
  
  // TODO: Send welcome email with temporary password
  // This requires configuring email templates in Supabase dashboard
  // or using a service like Resend/SendGrid
  // For now, the password will be shown in the UI after creation

  // Create organization membership if user has an organization
  if (userContext.organizationId) {
    // Use organizationRole from request, default to 'member'
    const memberRole = organizationRole || 'member'
    console.log('🏭 Creating organization membership:', { organizationId: userContext.organizationId, memberRole })
    
    // @ts-expect-error - Insert object not fully typed in generated types
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: userContext.organizationId,
        user_id: authUserId,
        role: memberRole,
        permissions: {},
      })

    if (memberError) {
      console.error('Failed to create organization membership:', memberError)
      // Don't fail the whole operation, just log the error
    } else {
      console.log('✅ Organization membership created with role:', memberRole)
    }
  }

  console.log('✅ User created/updated successfully:', { 
    userId: authUserId, 
    email: body.email,
    addedToOrganization: !!userContext.organizationId 
  })

  return createSuccessResponse({ 
    user: {
      id: authUserId,
      email: email,
      fullName: fullName,
      role: role || 'user',
    }
  }, { status: 201 })
}, {
  allowedMethods: ['POST']
})
