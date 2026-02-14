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
    role: body.role 
  })
  
  const { email, fullName, password, role } = body

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
  const { data: existingUser } = await supabaseClient
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (existingUser) {
    throw new Error('User with this email already exists')
  }

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

  // Create user in public.users table using admin client (bypasses RLS)
  // @ts-expect-error - Insert object not fully typed in generated types
  const { data: newUser, error: userError } = await supabaseAdmin
    .from('users')
    .insert({
      id: authUser.id,
      email: email,
      full_name: fullName,
      role: role || 'user',
      organization_id: userContext.organizationId, // Assign to admin's organization
    })
    .select()
    .single()

  if (userError) {
    console.error('Failed to create user record:', userError)
    throw new DatabaseError(`Failed to create user record: ${userError.message}`)
  }

  // Create organization membership if user has an organization
  if (userContext.organizationId) {
    // @ts-expect-error - Insert object not fully typed in generated types
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: userContext.organizationId,
        user_id: authUser.id,
        role: 'member',
        permissions: {},
      })

    if (memberError) {
      console.error('Failed to create organization membership:', memberError)
      // Don't fail the whole operation, just log the error
    }
  }

  console.log('✅ User created successfully:', { 
    userId: authUser.id, 
    email: body.email,
    addedToOrganization: !!userContext.organizationId 
  })

  // @ts-expect-error - newUser properties exist after successful insert
  return createSuccessResponse({ 
    user: {
      // @ts-expect-error - newUser properties exist
      id: newUser.id,
      // @ts-expect-error - newUser properties exist
      email: newUser.email,
      // @ts-expect-error - newUser properties exist
      fullName: newUser.full_name,
      // @ts-expect-error - newUser properties exist
      role: newUser.role,
    }
  }, { status: 201 })
}, {
  allowedMethods: ['POST']
})
