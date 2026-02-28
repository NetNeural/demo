import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export default createEdgeFunction(
  async ({ req }) => {
    const { email, password, fullName } = await req.json()

    // Validate input
    if (!email || !password || !fullName) {
      throw new Error('Email, password, and full name are required')
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Check if any super admin already exists
    const { data: existingSuperAdmins, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'super_admin')
      .limit(1)

    if (checkError) {
      console.error('Error checking existing super admins:', checkError)
      return new Response(
        JSON.stringify({ error: 'Failed to check existing super admins' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (existingSuperAdmins && existingSuperAdmins.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Super admin already exists' }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create user in auth.users
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: 'super_admin',
        },
      })

    if (authError || !authUser.user) {
      console.error('Error creating auth user:', authError)
      return new Response(
        JSON.stringify({ error: 'Failed to create user account' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create user record in public.users
    // @ts-expect-error - Insert object not fully typed in generated types
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: authUser.user.id,
      email,
      full_name: fullName,
      role: 'super_admin',
      organization_id: null,
      is_active: true,
    })

    if (userError) {
      console.error('Error creating user record:', userError)

      // Cleanup: delete the auth user if user record creation failed
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)

      throw new DatabaseError('Failed to create user profile', 500)
    }

    // Log the creation
    // @ts-expect-error - Insert object not fully typed in generated types
    await supabaseAdmin.from('audit_logs').insert({
      user_id: authUser.user.id,
      action: 'create',
      resource_type: 'user',
      resource_id: authUser.user.id,
      new_values: { role: 'super_admin', email },
      metadata: { source: 'bootstrap' },
    })

    return createSuccessResponse(
      {
        message: 'Super admin created successfully',
        user: {
          id: authUser.user.id,
          email,
          full_name: fullName,
          role: 'super_admin',
        },
      },
      { status: 201 }
    )
  },
  {
    allowedMethods: ['POST'],
  }
)
