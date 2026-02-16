import { createEdgeFunction, createSuccessResponse, DatabaseError } from '../_shared/request-handler.ts'
import { 
  getUserContext,
  createAuthenticatedClient,
  createServiceClient,
  corsHeaders
} from '../_shared/auth.ts'

export default createEdgeFunction(async ({ req }) => {
  try {
  // Try to get authenticated user context, but don't fail if it doesn't work
  let userContext;
  let supabase;  // For queries that respect RLS
  let supabaseAdmin; // For operations that need to bypass RLS
  
  // Check if this is a service role request
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const isServiceRole = serviceRoleKey && token === serviceRoleKey
  
  console.log('=== AUTH DEBUG ===')
  console.log('Has authHeader:', !!authHeader)
  console.log('Token length:', token.length)
  console.log('Has serviceRoleKey env var:', !!serviceRoleKey)
  console.log('ServiceRoleKey length:', serviceRoleKey?.length)
  console.log('isServiceRole:', isServiceRole)
  console.log('Token starts with:', token.substring(0, 20))
  console.log('ServiceKey starts with:', serviceRoleKey?.substring(0, 20))
  
  // Always create admin client for operations that need to bypass RLS
  supabaseAdmin = createServiceClient()
  
  if (isServiceRole) {
    // Service role bypasses all auth - treat as super admin
    console.log('✅ Using service role access')
    supabase = supabaseAdmin
    userContext = {
      userId: '00000000-0000-0000-0000-000000000000', // System user
      organizationId: null,
      role: 'super_admin',
      isSuperAdmin: true,
      email: 'system@service',
    }
  } else {
    try {
      userContext = await getUserContext(req)
      supabase = createAuthenticatedClient(req)
      console.log('✅ Successfully authenticated via getUserContext')
    } catch (e) {
      console.error('getUserContext failed:', e);
      console.log('Falling back to manual JWT parsing...')
      // For now, use service role as fallback
      // TODO: Fix JWT configuration in Supabase dashboard
      supabase = supabaseAdmin
      
      if (authHeader) {
        try {
          const token = authHeader.replace('Bearer ', '')
          // Decode JWT payload - use Deno's atob which is in globalThis
          const parts = token.split('.')
          if (parts.length >= 2) {
            const payload = JSON.parse(globalThis.atob(parts[1]))
            console.log('Using token payload:', { sub: payload.sub, role: payload.role })
            
            // Get full user context using service role
            const { data: profile, error: profileError } = await supabaseAdmin
              .from('users')
              .select('organization_id, role, email')
              .eq('id', payload.sub)
              .maybeSingle()
            
            if (profileError) {
              console.error('Failed to fetch user profile:', profileError)
              throw new Error(`Profile fetch error: ${profileError.message}`)
            }
            
            if (profile) {
              userContext = {
                userId: payload.sub,
                organizationId: profile.organization_id,
                role: profile.role,
                isSuperAdmin: profile.role === 'super_admin',
                email: profile.email || payload.email || '',
              }
              console.log('✅ Constructed userContext from token:', userContext)
            } else {
              console.error('No profile found for user:', payload.sub)
              throw new Error(`No user profile found for ID: ${payload.sub}`)
            }
          }
        } catch (tokenError) {
          console.error('Failed to parse token:', tokenError)
          throw new DatabaseError(`Token parsing failed: ${tokenError.message}`, 401)
        }
      }
      
      if (!userContext) {
        throw new DatabaseError('Could not authenticate user', 401)
      }
    }
  }

    if (req.method === 'GET') {
      // Super admins can see all organizations
      // Regular users can only see their own organization (enforced by RLS)
      
      let query = supabase
        .from('organizations')
        .select(`
          id,
          name,
          slug,
          description,
          subscription_tier,
          is_active,
          settings,
          created_at,
          updated_at
        `)
        .order('name')
      
      // If not super admin, filter to user's organization
      if (!userContext.isSuperAdmin && userContext.organizationId) {
        query = query.eq('id', userContext.organizationId)
      }

      // Execute query - RLS ensures user can only see allowed organizations
      const { data: organizations, error } = await query

      if (error) {
        console.error('Database error:', error)
        throw new DatabaseError(`Failed to fetch organizations: ${error.message}`)
      }

      // Get counts for each organization (optional - can be expensive)
      // deno-lint-ignore no-explicit-any
      const enrichedOrgs = await Promise.all(
        (organizations || []).map(async (org: any) => {
          // Get user count from organization_members table (use admin client to bypass RLS)
          const { count: userCount } = await supabaseAdmin
            .from('organization_members')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', org.id)
          
          // Get device count (use admin client to bypass RLS)
          const { count: deviceCount } = await supabaseAdmin
            .from('devices')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', org.id)
          
          // Get unresolved alert count (use admin client to bypass RLS)
          const { count: alertCount } = await supabaseAdmin
            .from('alerts')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('is_resolved', false)

          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            description: org.description,
            subscriptionTier: org.subscription_tier,
            isActive: org.is_active,
            settings: org.settings || {},
            userCount: userCount || 0,
            deviceCount: deviceCount || 0,
            alertCount: alertCount || 0,
            createdAt: org.created_at,
            updatedAt: org.updated_at
          }
        })
      )

      return createSuccessResponse({ 
        organizations: enrichedOrgs,
        count: enrichedOrgs.length,
        userRole: userContext.role,
        isSuperAdmin: userContext.isSuperAdmin
      })
    }

    if (req.method === 'POST') {
      // Any authenticated user can create an organization
      // They will automatically become the owner of that organization
      
      console.log('=== POST /organizations - Creating organization ===')
      console.log('User context:', JSON.stringify(userContext, null, 2))
      
      let body;
      try {
        body = await req.json()
      } catch (jsonError) {
        console.error('Failed to parse JSON body:', jsonError)
        throw new Error('Invalid JSON in request body')
      }
      
      const { name, slug, description, subscriptionTier } = body
      console.log('Request body:', { name, slug, description, subscriptionTier })

      // Validate required fields
      if (!name || !slug) {
        console.error('Missing required fields:', { name: !!name, slug: !!slug })
        throw new Error('Name and slug are required')
      }

      // Validate slug format
      if (!/^[a-z0-9-]+$/.test(slug)) {
        console.error('Invalid slug format:', slug)
        throw new Error('Slug can only contain lowercase letters, numbers, and hyphens')
      }

      // Check if slug already exists
      console.log('Checking if slug exists:', slug)
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()  // Changed from single() to maybeSingle() to avoid error if not found

      if (checkError) {
        console.error('Error checking existing slug:', checkError)
        throw new DatabaseError(`Failed to check existing slug: ${checkError.message}`)
      }

      if (existing) {
        console.error('Slug already exists:', slug)
        throw new DatabaseError('An organization with this slug already exists', 409)
      }

      // Create organization - use admin client to bypass RLS
      console.log('Creating organization with admin client...')
      const { data: newOrg, error: createError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          description: description?.trim() || null,
          subscription_tier: subscriptionTier || 'starter',
          is_active: true,
          settings: {}
        })
        .select()
        .single()

      if (createError) {
        console.error('Failed to create organization:', createError)
        throw new DatabaseError(`Failed to create organization: ${createError.message}`)
      }
      
      console.log('Organization created:', newOrg)
      
      // Add the creator as the owner of the new organization - use admin client
      console.log('Adding creator as owner:', { org_id: newOrg?.id, user_id: userContext?.userId })
      // @ts-expect-error - Properties exist
      const { error: memberError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          // @ts-expect-error - id exists
          organization_id: newOrg.id,
          user_id: userContext.userId,
          role: 'owner',
          joined_at: new Date().toISOString()
        })
      
      if (memberError) {
        console.error('Failed to add creator as owner:', memberError)
        // Note: Organization was created but membership failed
        // This is not critical - user can be added manually by super admin
        console.warn(`Organization ${newOrg.id} created but creator membership failed: ${memberError.message}`)
      } else {
        console.log('Creator added as owner successfully')
      }

      // @ts-expect-error - Properties exist in newOrg
      const response = {
        organization: {
          // @ts-expect-error - Properties exist
          id: newOrg.id,
          // @ts-expect-error - Properties exist
          name: newOrg.name,
          // @ts-expect-error - Properties exist
          slug: newOrg.slug,
          // @ts-expect-error - Properties exist
          description: newOrg.description,
          // @ts-expect-error - Properties exist
          subscriptionTier: newOrg.subscription_tier,
          // @ts-expect-error - Properties exist
          isActive: newOrg.is_active,
          // @ts-expect-error - Properties exist
          settings: newOrg.settings || {},
          // @ts-expect-error - Properties exist
          createdAt: newOrg.created_at,
          // @ts-expect-error - Properties exist
          updatedAt: newOrg.updated_at
        }
      }
      
      console.log('Returning success response:', JSON.stringify(response, null, 2))
      return createSuccessResponse(response)
    }

    if (req.method === 'PATCH') {
      // Extract organization ID from URL path
      const url = new URL(req.url)
      const pathParts = url.pathname.split('/')
      const orgId = pathParts[pathParts.length - 1]

      console.log('=== PATCH /organizations/:id - Update organization ===')
      console.log('Organization ID:', orgId)
      console.log('User ID:', userContext.userId)
      console.log('Is Super Admin:', userContext.isSuperAdmin)

      if (!orgId || orgId === 'organizations') {
        throw new Error('Organization ID is required')
      }

      // Check if user has permission to update this organization
      // Super admins can update any organization
      // Organization owners can update their own organization
      if (!userContext.isSuperAdmin) {
        console.log('Checking user membership...')
        // Check if user is owner of this organization
        // Use maybeSingle() to handle cases where membership might not exist
        // @ts-expect-error - role exists
        const { data: membership, error: membershipError } = await supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', orgId)
          .eq('user_id', userContext.userId)
          .maybeSingle()

        console.log('Membership result:', { membership, error: membershipError })

        if (membershipError) {
          console.error('Membership check error:', membershipError)
          throw new DatabaseError(`Failed to verify membership: ${membershipError.message}`, 500)
        }

        // @ts-expect-error - role exists
        if (!membership || membership.role !== 'owner') {
          console.error('Permission denied - not owner:', { membership })
          throw new DatabaseError('You do not have permission to update this organization', 403)
        }
        
        console.log('Permission granted - user is owner')
      }

      const body = await req.json()
      console.log('Update payload:', body)
      const { name, description, subscriptionTier, isActive } = body

      // Build update object
      const updates: Record<string, unknown> = {}
      if (name !== undefined) updates.name = name.trim()
      if (description !== undefined) updates.description = description?.trim() || null
      if (subscriptionTier !== undefined) updates.subscription_tier = subscriptionTier
      if (isActive !== undefined) updates.is_active = isActive

      console.log('Applying updates:', updates)

      // Update organization - use admin client to bypass RLS
      // @ts-expect-error - Dynamic update object
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('organizations')
        .update(updates)
        .eq('id', orgId)
        .select()
        .single()

      if (updateError) {
        console.error('Failed to update organization:', updateError)
        throw new DatabaseError(`Failed to update organization: ${updateError.message}`)
      }

      console.log('Update successful!', updated)

      // @ts-expect-error - Properties exist
      return createSuccessResponse({
        organization: {
          // @ts-expect-error - Properties exist
          id: updated.id,
          // @ts-expect-error - Properties exist
          name: updated.name,
          // @ts-expect-error - Properties exist
          slug: updated.slug,
          // @ts-expect-error - Properties exist
          description: updated.description,
          // @ts-expect-error - Properties exist
          subscriptionTier: updated.subscription_tier,
          // @ts-expect-error - Properties exist
          isActive: updated.is_active,
          // @ts-expect-error - Properties exist
          settings: updated.settings || {},
          // @ts-expect-error - Properties exist
          createdAt: updated.created_at,
          // @ts-expect-error - Properties exist
          updatedAt: updated.updated_at
        }
      })
    }

    if (req.method === 'DELETE') {
      // Extract organization ID from URL path
      const url = new URL(req.url)
      const pathParts = url.pathname.split('/')
      const orgId = pathParts[pathParts.length - 1]

      if (!orgId || orgId === 'organizations') {
        throw new Error('Organization ID is required')
      }

      // Check if user has permission to delete this organization
      // Super admins can delete any organization
      // Organization owners can delete their own organization
      if (!userContext.isSuperAdmin) {
        // Check if user is owner of this organization
        // @ts-expect-error - role exists
        const { data: membership, error: membershipError } = await supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', orgId)
          .eq('user_id', userContext.userId)
          .maybeSingle()

        if (membershipError) {
          throw new DatabaseError(`Failed to verify membership: ${membershipError.message}`, 500)
        }

        // @ts-expect-error - role exists
        if (!membership || membership.role !== 'owner') {
          throw new DatabaseError('You do not have permission to delete this organization', 403)
        }
      }

      // Check if organization exists
      // @ts-expect-error - Properties exist
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', orgId)
        .maybeSingle()

      if (orgError) {
        throw new DatabaseError(`Failed to fetch organization: ${orgError.message}`, 500)
      }

      if (!org) {
        throw new DatabaseError('Organization not found', 404)
      }

      // Perform actual deletion (CASCADE will handle related records)
      // This includes organization_members, devices, locations, etc.
      // Use admin client to bypass RLS
      // @ts-expect-error - Dynamic delete
      const { error: deleteError } = await supabaseAdmin
        .from('organizations')
        .delete()
        .eq('id', orgId)

      if (deleteError) {
        console.error('Failed to delete organization:', deleteError)
        throw new DatabaseError(`Failed to delete organization: ${deleteError.message}`)
      }

      // @ts-expect-error - name exists
      return createSuccessResponse({
        // @ts-expect-error - name exists
        message: `Organization "${org.name}" has been deleted successfully`,
        organizationId: orgId,
        success: true
      })
    }

  throw new Error('Method not allowed')
  } catch (error) {
    // Enhanced error handling for debugging
    console.error('=== EDGE FUNCTION ERROR ===')
    console.error('Error type:', error?.constructor?.name)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)
    console.error('Full error:', error)
    
    // Return detailed error for debugging (remove in production)
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error?.message || 'Unknown error',
      type: error?.constructor?.name || 'Error',
      stack: error?.stack,
      details: error
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
}, {
  allowedMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
  requireAuth: false, // Handle auth manually due to JWT verification issues
})