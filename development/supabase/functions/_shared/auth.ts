/**
 * Authentication and authorization utilities for Edge Functions
 */

/// <reference types="https://deno.land/x/types/index.d.ts" />

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.ts'

export interface UserContext {
  userId: string
  organizationId: string | null
  role: 'super_admin' | 'org_owner' | 'org_admin' | 'user' | 'viewer'
  isSuperAdmin: boolean
  email: string
}

/**
 * Extract auth token from request headers
 */
export function extractAuthToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return null
  }
  
  // Handle both "Bearer token" and just "token" formats
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  
  return authHeader
}

/**
 * Create an authenticated Supabase client from request
 */
export function createAuthenticatedClient(req: Request) {
  const authToken = extractAuthToken(req)
  
  if (!authToken) {
    throw new Error('Missing authorization header')
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration')
  }

  return createClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/**
 * Get authenticated user context with organization and role information
 * This enforces RLS and returns the user's organization context
 */
export async function getUserContext(req: Request): Promise<UserContext> {
  const supabase = createAuthenticatedClient(req)
  
  // Get the authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new Error('Unauthorized - invalid or expired token')
  }

  // Get user profile with role and organization
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('organization_id, role, email')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw new Error('User profile not found')
  }

  // Type assertion for profile data
  const userProfile = profile as {
    organization_id: string | null
    role: string
    email: string
  }

  return {
    userId: user.id,
    organizationId: userProfile.organization_id,
    role: userProfile.role as UserContext['role'],
    isSuperAdmin: userProfile.role === 'super_admin',
    email: userProfile.email || user.email || '',
  }
}

/**
 * Determine the organization ID to use for queries
 * - Super admins can specify organization_id in query params
 * - Regular users can only access their own organization
 * - Returns null if user has no organization and isn't super admin
 */
export function getTargetOrganizationId(
  userContext: UserContext,
  requestedOrgId?: string | null
): string | null {
  // Super admins can query any organization
  if (userContext.isSuperAdmin) {
    return requestedOrgId || null
  }
  
  // Regular users can only access their own organization
  return userContext.organizationId
}

/**
 * Check if user has permission to perform an action
 */
export function hasPermission(
  userContext: UserContext,
  action: 'view' | 'create' | 'update' | 'delete',
  resourceOrgId?: string | null
): boolean {
  // Super admins can do anything
  if (userContext.isSuperAdmin) {
    return true
  }

  // User must be in an organization
  if (!userContext.organizationId) {
    return false
  }

  // If resource has an org ID, it must match user's org
  if (resourceOrgId && resourceOrgId !== userContext.organizationId) {
    return false
  }

  // Check role-based permissions
  switch (action) {
    case 'view':
      return true // All authenticated users can view their org's data
    
    case 'create':
    case 'update':
      return ['org_owner', 'org_admin', 'user'].includes(userContext.role)
    
    case 'delete':
      return ['org_owner', 'org_admin'].includes(userContext.role)
    
    default:
      return false
  }
}

/**
 * Standard CORS headers for Edge Functions
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

/**
 * Create error response with CORS headers
 */
export function createAuthErrorResponse(message: string, status: number = 401) {
  return new Response(
    JSON.stringify({
      error: message,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  )
}

/**
 * Create success response with CORS headers
 */
export function createSuccessResponse(data: Record<string, unknown>, status: number = 200) {
  return new Response(
    JSON.stringify({
      ...data,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  )
}
