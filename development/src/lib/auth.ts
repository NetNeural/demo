import { createClient } from '@/lib/supabase/client'

export interface UserProfile {
  id: string
  email: string
  fullName: string | null
  organizationId: string | null // NULL for super admins
  organizationName: string | null
  role: 'super_admin' | 'org_owner' | 'org_admin' | 'user' | 'viewer'
  isSuperAdmin: boolean
  passwordChangeRequired: boolean // True if user has temp password and must change it
}

/**
 * Get the current authenticated user and their organization
 * @returns User profile with organization info, or null if not authenticated
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = createClient()

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (!user || authError) {
    return null
  }

  // Get user's profile with organization info
  // Note: organization can be NULL for super admins
  const { data: profile, error: profileError } = (await supabase
    .from('users')
    .select('role, organization_id, password_change_required, full_name')
    .eq('id', user.id)
    .single()) as {
    data: {
      role: string
      organization_id: string | null
      password_change_required: boolean | null
      full_name: string | null
    } | null
    error: any
  }

  if (profileError || !profile) {
    console.error('Failed to fetch user profile:', profileError)
    return null
  }

  // Separately fetch organization if user has one
  let organization = null
  if (profile.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', profile.organization_id)
      .single()

    organization = org
  }

  const isSuperAdmin = profile.role === 'super_admin'
  const passwordChangeRequired = profile.password_change_required === true

  // Super admins don't need an organization (organization_id is NULL)
  if (isSuperAdmin) {
    return {
      id: user.id,
      email: user.email || '',
      fullName: profile.full_name || null,
      organizationId: null,
      organizationName: null,
      role: (profile.role || 'viewer') as
        | 'super_admin'
        | 'org_admin'
        | 'org_owner'
        | 'user'
        | 'viewer',
      isSuperAdmin: true,
      passwordChangeRequired,
    }
  }

  // Regular users must have an organization
  if (!organization) {
    console.error('User has no organization assigned')
    return null
  }

  return {
    id: user.id,
    email: user.email || '',
    fullName: profile.full_name || null,
    organizationId: organization.id,
    organizationName: organization.name,
    role: (profile.role || 'viewer') as
      | 'super_admin'
      | 'org_admin'
      | 'org_owner'
      | 'user'
      | 'viewer',
    isSuperAdmin: false,
    passwordChangeRequired,
  }
}

/**
 * Fetch data from a Supabase edge function with proper auth headers
 * @param functionName The edge function name (e.g., 'devices', 'alerts')
 * @param params Optional URL search parameters
 * @returns Parsed JSON response
 */
export async function fetchEdgeFunction(
  functionName: string,
  params?: Record<string, string>
): Promise<unknown> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  // Build URL with params
  const url = new URL(`${supabaseUrl}/functions/v1/${functionName}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Edge function '${functionName}' failed: ${error}`)
  }

  return response.json()
}
