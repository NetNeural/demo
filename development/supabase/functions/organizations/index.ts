import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { 
  getUserContext,
  createAuthenticatedClient,
  createAuthErrorResponse,
  createSuccessResponse,
  corsHeaders 
} from '../_shared/auth.ts'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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
        return createAuthErrorResponse(`Failed to fetch organizations: ${error.message}`, 500)
      }

      // Get counts for each organization (optional - can be expensive)
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
        return createAuthErrorResponse('Only super admins can create organizations', 403)
      }

      const body = await req.json()
      const { name, slug, description, subscriptionTier } = body

      // Validate required fields
      if (!name || !slug) {
        return createAuthErrorResponse('Name and slug are required', 400)
      }

      // Validate slug format
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return createAuthErrorResponse('Slug can only contain lowercase letters, numbers, and hyphens', 400)
      }

      // Check if slug already exists
      const { data: existing } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .single()

      if (existing) {
        return createAuthErrorResponse('An organization with this slug already exists', 409)
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
        return createAuthErrorResponse(`Failed to create organization: ${createError.message}`, 500)
      }

      return createSuccessResponse({
        organization: {
          id: newOrg.id,
          name: newOrg.name,
          slug: newOrg.slug,
          description: newOrg.description,
          subscriptionTier: newOrg.subscription_tier,
          isActive: newOrg.is_active,
          settings: newOrg.settings || {},
          createdAt: newOrg.created_at,
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
        return createAuthErrorResponse('Organization ID is required', 400)
      }

      // Check if user has permission to update this organization
      // Super admins can update any organization
      // Organization owners can update their own organization
      if (!userContext.isSuperAdmin) {
        // Check if user is owner of this organization
        const { data: membership } = await supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', orgId)
          .eq('user_id', userContext.userId)
          .single()

        if (!membership || membership.role !== 'owner') {
          return createAuthErrorResponse('You do not have permission to update this organization', 403)
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
      const { data: updated, error: updateError } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', orgId)
        .select()
        .single()

      if (updateError) {
        console.error('Failed to update organization:', updateError)
        return createAuthErrorResponse(`Failed to update organization: ${updateError.message}`, 500)
      }

      return createSuccessResponse({
        organization: {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          description: updated.description,
          subscriptionTier: updated.subscription_tier,
          isActive: updated.is_active,
          settings: updated.settings || {},
          createdAt: updated.created_at,
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
        return createAuthErrorResponse('Organization ID is required', 400)
      }

      // Only super admins can delete organizations
      if (!userContext.isSuperAdmin) {
        return createAuthErrorResponse('Only super admins can delete organizations', 403)
      }

      // Check if organization exists
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', orgId)
        .single()

      if (!org) {
        return createAuthErrorResponse('Organization not found', 404)
      }

      // Soft delete by marking as inactive (safer than hard delete)
      // Hard delete would cascade and remove all related data
      const { error: deleteError } = await supabase
        .from('organizations')
        .update({ is_active: false })
        .eq('id', orgId)

      if (deleteError) {
        console.error('Failed to delete organization:', deleteError)
        return createAuthErrorResponse(`Failed to delete organization: ${deleteError.message}`, 500)
      }

      return createSuccessResponse({
        message: `Organization "${org.name}" has been deactivated`,
        organizationId: orgId
      })
    }

    return createAuthErrorResponse('Method not allowed', 405)
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Edge function error:', errorMessage, error)
    
    // Handle auth errors specifically
    if (errorMessage.includes('Unauthorized') || errorMessage.includes('authorization')) {
      return createAuthErrorResponse(errorMessage, 401)
    }
    
    return createAuthErrorResponse(errorMessage, 500)
  }
})