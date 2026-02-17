/**
 * React Query Hooks for Organizations and Users
 * 
 * Implements caching strategy per Story 3.3:
 * - Static data: 5 minutes cache (organizations, users)
 * - Efficient role-based access queries
 * - Automatic cache invalidation on updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, CACHE_TIME } from '@/lib/query-client'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'

export type Organization = Database['public']['Tables']['organizations']['Row']

export type User = Database['public']['Tables']['users']['Row']

export type OrganizationMember = Database['public']['Tables']['organization_members']['Row'] & {
  user?: User
}

/**
 * Hook: Fetch all organizations
 * 
 * Cache: 5 minutes (static data)
 * 
 * @example
 * ```tsx
 * const { data: organizations } = useOrganizationsQuery()
 * ```
 */
export function useOrganizationsQuery() {
  const supabase = createClient()

  return useQuery({
    queryKey: queryKeys.organizations,
    queryFn: async (): Promise<Organization[]> => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name')

      if (error) {
        throw new Error(error.message || 'Failed to fetch organizations')
      }

      return data || []
    },
    staleTime: CACHE_TIME.STATIC_DATA, // 5 minutes
  })
}

/**
 * Hook: Fetch single organization
 * 
 * @example
 * ```tsx
 * const { data: org } = useOrganizationQuery('org-123')
 * ```
 */
export function useOrganizationQuery(organizationId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: queryKeys.organization(organizationId),
    queryFn: async (): Promise<Organization> => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single()

      if (error) {
        throw new Error(error.message || 'Failed to fetch organization')
      }

      return data
    },
    staleTime: CACHE_TIME.STATIC_DATA, // 5 minutes
    enabled: !!organizationId,
  })
}

/**
 * Hook: Fetch organization members
 * 
 * @example
 * ```tsx
 * const { data: members } = useOrganizationMembersQuery('org-123')
 * ```
 */
export function useOrganizationMembersQuery(organizationId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: queryKeys.organizationMembers(organizationId),
    queryFn: async (): Promise<OrganizationMember[]> => {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          *,
          user:users!organization_members_user_id_fkey(*)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(error.message || 'Failed to fetch organization members')
      }

      return data || []
    },
    staleTime: CACHE_TIME.STATIC_DATA, // 5 minutes
    enabled: !!organizationId,
  })
}

/**
 * Hook: Fetch current user
 * 
 * @example
 * ```tsx
 * const { data: currentUser } = useCurrentUserQuery()
 * ```
 */
export function useCurrentUserQuery() {
  const supabase = createClient()

  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error) {
        throw new Error(error.message || 'Failed to fetch current user')
      }

      return user
    },
    staleTime: CACHE_TIME.STATIC_DATA, // 5 minutes
  })
}

/**
 * Hook: Fetch all users
 * 
 * @example
 * ```tsx
 * const { data: users } = useUsersQuery()
 * ```
 */
export function useUsersQuery() {
  const supabase = createClient()

  return useQuery({
    queryKey: queryKeys.users,
    queryFn: async (): Promise<User[]> => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('email')

      if (error) {
        throw new Error(error.message || 'Failed to fetch users')
      }

      return data || []
    },
    staleTime: CACHE_TIME.STATIC_DATA, // 5 minutes
  })
}

/**
 * Hook: Fetch single user
 * 
 * @example
 * ```tsx
 * const { data: user } = useUserQuery('user-123')
 * ```
 */
export function useUserQuery(userId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: queryKeys.user(userId),
    queryFn: async (): Promise<User> => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        throw new Error(error.message || 'Failed to fetch user')
      }

      return data
    },
    staleTime: CACHE_TIME.STATIC_DATA, // 5 minutes
    enabled: !!userId,
  })
}

/**
 * Hook: Update organization mutation
 * 
 * @example
 * ```tsx
 * const updateOrg = useUpdateOrganizationMutation()
 * updateOrg.mutate({ id: 'org-123', name: 'New Name' })
 * ```
 */
export function useUpdateOrganizationMutation() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (org: { id: string; [key: string]: unknown }) => {
      const { data, error } = await supabase
        .from('organizations')
        .update(org)
        .eq('id', org.id)
        .select()
        .single()

      if (error) {
        throw new Error(error.message || 'Failed to update organization')
      }

      return data
    },
    onSuccess: (data) => {
      // Invalidate organization queries
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations })
      queryClient.setQueryData(queryKeys.organization(data.id), data)
    },
  })
}

/**
 * Hook: Add organization member mutation
 * 
 * @example
 * ```tsx
 * const addMember = useAddOrganizationMemberMutation()
 * addMember.mutate({
 *   organizationId: 'org-123',
 *   userId: 'user-456',
 *   role: 'member'
 * })
 * ```
 */
export function useAddOrganizationMemberMutation() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (params: {
      organizationId: string
      userId: string
      role: OrganizationMember['role']
    }) => {
      const { data, error } = await supabase
        .from('organization_members')
        .insert({
          organization_id: params.organizationId,
          user_id: params.userId,
          role: params.role,
        })
        .select()
        .single()

      if (error) {
        throw new Error(error.message || 'Failed to add organization member')
      }

      return data
    },
    onSuccess: (_, variables) => {
      // Invalidate organization members queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizationMembers(variables.organizationId)
      })
    },
  })
}

/**
 * Hook: Remove organization member mutation
 * 
 * @example
 * ```tsx
 * const removeMember = useRemoveOrganizationMemberMutation()
 * removeMember.mutate({ organizationId: 'org-123', userId: 'user-456' })
 * ```
 */
export function useRemoveOrganizationMemberMutation() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (params: {
      organizationId: string
      userId: string
    }) => {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', params.organizationId)
        .eq('user_id', params.userId)

      if (error) {
        throw new Error(error.message || 'Failed to remove organization member')
      }

      return params
    },
    onSuccess: (params) => {
      // Invalidate organization members queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizationMembers(params.organizationId)
      })
    },
  })
}

/**
 * Migration Guide:
 * 
 * BEFORE (Context-based):
 * ```tsx
 * const { currentOrganization, members, loading } = useOrganization()
 * ```
 * 
 * AFTER (React Query):
 * ```tsx
 * const { data: organization } = useOrganizationQuery(orgId)
 * const { data: members } = useOrganizationMembersQuery(orgId)
 * ```
 * 
 * Benefits:
 * - 5-minute caching (minimal API calls for static data)
 * - Request deduplication
 * - No context provider complexity
 * - Easier testing
 * - Better TypeScript inference
 */
