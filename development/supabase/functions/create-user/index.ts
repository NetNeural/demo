import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { 
  getUserContext, 
  createAuthenticatedClient,
  corsHeaders 
} from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user context
    const userContext = await getUserContext(req)
    
    // Create authenticated Supabase client (respects RLS)
    const supabaseClient = createAuthenticatedClient(req)

    // Only admins, owners, and super admins can create users
    if (!['super_admin', 'org_owner', 'org_admin'].includes(userContext.role)) {
      throw new Error('Insufficient permissions to create users')
    }

    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    const body = await req.json()
    const { email, fullName, password, role } = body

    if (!email || !fullName || !password) {
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

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

    // Create user in public.users table
    const { data: newUser, error: userError } = await supabaseClient
      .from('users')
      .insert({
        id: authUser.id,
        email: email,
        full_name: fullName,
        role: role || 'user',
      })
      .select()
      .single()

    if (userError) {
      // If public user creation fails, we should clean up the auth user
      // But for now, just throw the error
      throw new Error(`Failed to create user record: ${userError.message}`)
    }

    return new Response(
      JSON.stringify({ 
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.full_name,
          role: newUser.role,
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      }
    )
  } catch (error) {
    console.error('Error in create-user function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
