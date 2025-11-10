import { createEdgeFunction, createSuccessResponse, DatabaseError } from '../_shared/request-handler.ts'
import { 
  getUserContext,
  createAuthenticatedClient
} from '../_shared/auth.ts'

export default createEdgeFunction(async ({ req }) => {
  // Get authenticated user context
  const userContext = await getUserContext(req)
  
  // Create authenticated Supabase client (respects RLS)
  const supabase = createAuthenticatedClient(req)

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
          // Get user count
          const { count: userCount } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', org.id)
          
          // Get device count
          const { count: deviceCount } = await supabase
            .from('devices')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', org.id)
          
          // Get unresolved alert count
          const { count: alertCount } = await supabase
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
      // Only super admins can create organizations
      if (!userContext.isSuperAdmin) {
        throw new DatabaseError('Only super admins can create organizations', 403)
      }

      const body = await req.json()
      const { name, slug, description, subscriptionTier } = body

      // Validate required fields
      if (!name || !slug) {
        throw new Error('Name and slug are required')
      }

      // Validate slug format
      if (!/^[a-z0-9-]+$/.test(slug)) {
        throw new Error('Slug can only contain lowercase letters, numbers, and hyphens')
      }

      // Check if slug already exists
      const { data: existing } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .single()

      if (existing) {
        throw new DatabaseError('An organization with this slug already exists', 409)
      }

      // Create organization
      const { data: newOrg, error: createError } = await supabase
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

      // @ts-expect-error - Properties exist in newOrg
      return createSuccessResponse({
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
      })
    }

    if (req.method === 'PATCH') {
      // Extract organization ID from URL path
      const url = new URL(req.url)
      const pathParts = url.pathname.split('/')
      const orgId = pathParts[pathParts.length - 1]

      if (!orgId || orgId === 'organizations') {
        throw new Error('Organization ID is required')
      }

      // Check if user has permission to update this organization
      // Super admins can update any organization
      // Organization owners can update their own organization
      if (!userContext.isSuperAdmin) {
        // Check if user is owner of this organization
        // @ts-expect-error - role exists
        const { data: membership } = await supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', orgId)
          .eq('user_id', userContext.userId)
          .single()

        // @ts-expect-error - role exists
        if (!membership || membership.role !== 'owner') {
          throw new DatabaseError('You do not have permission to update this organization', 403)
        }
      }

      const body = await req.json()
      const { name, description, subscriptionTier, isActive } = body

      // Build update object
      const updates: Record<string, unknown> = {}
      if (name !== undefined) updates.name = name.trim()
      if (description !== undefined) updates.description = description?.trim() || null
      if (subscriptionTier !== undefined) updates.subscription_tier = subscriptionTier
      if (isActive !== undefined) updates.is_active = isActive

      // Update organization
      // @ts-expect-error - Dynamic update object
      const { data: updated, error: updateError } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', orgId)
        .select()
        .single()

      if (updateError) {
        console.error('Failed to update organization:', updateError)
        throw new DatabaseError(`Failed to update organization: ${updateError.message}`)
      }

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

      // Only super admins can delete organizations
      if (!userContext.isSuperAdmin) {
        throw new DatabaseError('Only super admins can delete organizations', 403)
      }

      // Check if organization exists
      // @ts-expect-error - Properties exist
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', orgId)
        .single()

      if (!org) {
        throw new DatabaseError('Organization not found', 404)
      }

      // Soft delete by marking as inactive (safer than hard delete)
      // Hard delete would cascade and remove all related data
      // @ts-expect-error - Dynamic update
      const { error: deleteError } = await supabase
        .from('organizations')
        .update({ is_active: false })
        .eq('id', orgId)

      if (deleteError) {
        console.error('Failed to delete organization:', deleteError)
        throw new DatabaseError(`Failed to delete organization: ${deleteError.message}`)
      }

      // @ts-expect-error - name exists
      return createSuccessResponse({
        // @ts-expect-error - name exists
        message: `Organization "${org.name}" has been deactivated`,
        organizationId: orgId
      })
    }

  throw new Error('Method not allowed')
}, {
  allowedMethods: ['GET', 'POST', 'PATCH', 'DELETE']
})