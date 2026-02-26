'use client'

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { useUser } from '@/contexts/UserContext'
import { edgeFunctions } from '@/lib/edge-functions/client'
import type {
  UserOrganization,
  OrganizationPermissions,
  OrganizationRole,
  OrganizationStats,
  SubscriptionTier,
  OrganizationSettings,
} from '@/types/organization'
import { getOrganizationPermissions, isResellerOrg } from '@/types/organization'

// Issue #280: Typed API response shapes (replace 'as any')
interface OrgApiItem {
  id: string
  name: string
  slug: string
  description: string | null
  subscriptionTier: string
  isActive: boolean
  settings: Record<string, unknown> | null
  parentOrganizationId: string | null
  createdBy: string | null
  memberRole: string | null
  createdAt: string
  updatedAt: string
  deviceCount: number
  userCount: number
  alertCount: number
}

interface OrgListResponse {
  organizations: OrgApiItem[]
  isSuperAdmin: boolean
}

interface OrgStatsResponse {
  totalDevices: number
  onlineDevices: number
  totalUsers: number
  activeAlerts: number
  totalLocations: number
  activeIntegrations: number
}

interface OrganizationContextType {
  // Current organization
  currentOrganization: UserOrganization | null

  // All user's organizations
  userOrganizations: UserOrganization[]

  // Loading states
  isLoading: boolean
  isLoadingStats: boolean

  // Organization stats
  stats: OrganizationStats | null

  // Actions
  switchOrganization: (organizationId: string) => void
  refreshOrganizations: () => Promise<void>
  refreshStats: () => Promise<void>

  // Permissions (computed from current org role)
  permissions: OrganizationPermissions

  // User's role in current organization
  userRole: OrganizationRole | null

  // Convenience checks
  isOwner: boolean
  isAdmin: boolean
  isMember: boolean
  isViewer: boolean
  canManageMembers: boolean
  canManageDevices: boolean
  canManageIntegrations: boolean

  // Reseller capabilities
  isReseller: boolean
  canCreateChildOrgs: boolean
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
)

interface OrganizationProviderProps {
  children: React.ReactNode
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const { user } = useUser()

  // Initialize from localStorage immediately
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('netneural_current_org')
    }
    return null
  })

  const [userOrganizations, setUserOrganizations] = useState<
    UserOrganization[]
  >([])
  const [stats, setStats] = useState<OrganizationStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingStats, setIsLoadingStats] = useState(false)

  // Generation counter to discard stale stats responses after org switch (Bug #232)
  const statsGenerationRef = useRef(0)

  // Fetch user's organizations
  const fetchUserOrganizations = useCallback(async () => {
    if (!user?.id) {
      setUserOrganizations([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)

      // Supabase URL is now handled dynamically in the config
      // No need to check env variable here since config.ts handles it

      // Fetch organizations using edge function client
      const response = await edgeFunctions.organizations.list()

      if (!response.success || !response.data) {
        console.error('Failed to fetch organizations:', response.error)
        setUserOrganizations([])
        setIsLoading(false)
        return
      }

      const data = response.data as OrgListResponse

      // Transform API response to UserOrganization format
      const organizations: UserOrganization[] = (
        data.organizations || []
      ).map((org: OrgApiItem): UserOrganization => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          description: org.description ?? undefined,
          subscription_tier: org.subscriptionTier as SubscriptionTier,
          is_active: org.isActive,
          settings: (org.settings as OrganizationSettings) ?? undefined,
          parent_organization_id: org.parentOrganizationId || null,
          created_by: org.createdBy || null,
          role: (org.memberRole || (data.isSuperAdmin ? 'owner' : 'admin')) as OrganizationRole,
          membershipId: `mem-${org.id}`,
          joinedAt: org.createdAt,
          created_at: org.createdAt,
          updated_at: org.updatedAt,
          deviceCount: org.deviceCount,
          userCount: org.userCount,
          activeAlertsCount: org.alertCount,
        })
      )

      setUserOrganizations(organizations)

      // Auto-select first org if none selected AND none saved in localStorage
      const savedOrgId = localStorage.getItem('netneural_current_org')

      if (!savedOrgId && organizations.length > 0 && organizations[0]) {
        // No saved org, select first one
        setCurrentOrgId(organizations[0].id)
        localStorage.setItem('netneural_current_org', organizations[0].id)
      } else if (
        savedOrgId &&
        organizations.some((org) => org.id === savedOrgId)
      ) {
        // Ensure the saved org is set
        setCurrentOrgId(savedOrgId)
      } else if (savedOrgId && organizations.length > 0 && organizations[0]) {
        // Saved org not found, select first available
        setCurrentOrgId(organizations[0].id)
        localStorage.setItem('netneural_current_org', organizations[0].id)
      } else if (
        !currentOrgId &&
        organizations.length > 0 &&
        organizations[0]
      ) {
        // Edge case: currentOrgId is null but we have orgs - force selection
        setCurrentOrgId(organizations[0].id)
        localStorage.setItem('netneural_current_org', organizations[0].id)
      }
    } catch (error) {
      console.error('Error fetching user organizations:', error)
      setUserOrganizations([])
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]) // Bug #222 fix: removed currentOrgId — it caused a re-fetch loop on first org selection

  // Fetch organization stats
  const fetchOrganizationStats = useCallback(async () => {
    // Guard: don't fetch until both org and user session are available.
    // currentOrgId is eagerly set from localStorage before the Supabase session
    // restores, so firing without user?.id sends the anon key as the Bearer
    // token which the edge function correctly rejects.
    if (!currentOrgId || !user?.id) {
      setStats(null)
      return
    }

    // Bug #232 fix: bump generation so that in-flight responses from the
    // previous org are discarded when they finally resolve.
    const generation = ++statsGenerationRef.current

    try {
      setIsLoadingStats(true)

      // Fetch dashboard stats using edge function client
      const response = await edgeFunctions.organizations.stats(currentOrgId)

      // Bug #232: discard stale response if org switched while we were waiting
      if (generation !== statsGenerationRef.current) {
        return
      }

      if (!response.success || !response.data) {
        // Only log error if we're authenticated (not on login page)
        if (user) {
          console.error('Failed to fetch stats:', response.error)
        }
        setStats(null)
        return
      }

      const statsData = response.data as OrgStatsResponse

      const fetchedStats: OrganizationStats = {
        totalDevices: statsData.totalDevices || 0,
        onlineDevices: statsData.onlineDevices || 0,
        totalUsers: statsData.totalUsers || 0,
        activeAlerts: statsData.activeAlerts || 0,
        totalLocations: statsData.totalLocations || 0,
        activeIntegrations: statsData.activeIntegrations || 0,
      }

      setStats(fetchedStats)
    } catch (error) {
      // Bug #232: don't set fallback stats if org already switched
      if (generation !== statsGenerationRef.current) return

      console.error('Error fetching organization stats:', error)
      // Fall back to cached data from userOrganizations
      const currentOrg = userOrganizations.find(
        (org) => org.id === currentOrgId
      )
      if (currentOrg) {
        setStats({
          totalDevices: currentOrg.deviceCount || 0,
          onlineDevices: Math.floor((currentOrg.deviceCount || 0) * 0.85),
          totalUsers: currentOrg.userCount || 0,
          activeAlerts: currentOrg.activeAlertsCount || 0,
          totalLocations: 0,
          activeIntegrations: 0,
        })
      } else {
        setStats(null)
      }
    } finally {
      // Bug #232: only clear loading state if this is still the active generation
      if (generation === statsGenerationRef.current) {
        setIsLoadingStats(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId, user?.id]) // Include user?.id so stats re-fetch once the session is available after initial mount

  // Load organizations on mount or user change
  useEffect(() => {
    fetchUserOrganizations()
  }, [fetchUserOrganizations])

  // Load stats when organization changes
  useEffect(() => {
    fetchOrganizationStats()
  }, [fetchOrganizationStats])

  // Validate saved organization when organizations load
  useEffect(() => {
    if (userOrganizations.length > 0 && currentOrgId) {
      // Check if saved org is still valid
      const orgExists = userOrganizations.some((org) => org.id === currentOrgId)
      if (!orgExists && userOrganizations[0]) {
        // If saved org doesn't exist, select first available
        setCurrentOrgId(userOrganizations[0].id)
        localStorage.setItem('netneural_current_org', userOrganizations[0].id)
      }
    }
  }, [userOrganizations, currentOrgId])

  // Switch organization
  const switchOrganization = useCallback(
    (organizationId: string) => {
      const org = userOrganizations.find((o) => o.id === organizationId)
      if (org) {
        setCurrentOrgId(organizationId)
        localStorage.setItem('netneural_current_org', organizationId)
        setStats(null) // Clear stats while loading new org
      }
    },
    [userOrganizations]
  )

  // Get current organization
  const currentOrganization = useMemo(() => {
    return userOrganizations.find((org) => org.id === currentOrgId) || null
  }, [userOrganizations, currentOrgId])

  // Get user's role in current organization
  const userRole = useMemo(() => {
    return currentOrganization?.role || null
  }, [currentOrganization])

  // Calculate permissions based on role
  const permissions = useMemo(() => {
    if (!userRole) {
      return getOrganizationPermissions('viewer')
    }
    return getOrganizationPermissions(userRole)
  }, [userRole])

  // Convenience role checks
  const isOwner = userRole === 'owner'
  const isAdmin = userRole === 'admin'
  const isMember = userRole === 'member'
  const isViewer = userRole === 'viewer'

  // Reseller checks
  const isReseller = isResellerOrg(currentOrganization)
  const canCreateChildOrgs = isReseller && (isOwner || isAdmin)

  const value: OrganizationContextType = {
    currentOrganization,
    userOrganizations,
    isLoading,
    isLoadingStats,
    stats,
    switchOrganization,
    refreshOrganizations: fetchUserOrganizations,
    refreshStats: fetchOrganizationStats,
    permissions,
    userRole,
    isOwner,
    isAdmin,
    isMember,
    isViewer,
    canManageMembers: permissions.canManageMembers,
    canManageDevices: permissions.canManageDevices,
    canManageIntegrations: permissions.canManageIntegrations,
    isReseller,
    canCreateChildOrgs,
  }

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

/**
 * Hook to access organization context
 * Must be used within OrganizationProvider
 */
export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within OrganizationProvider')
  }
  return context
}

/**
 * Hook to require organization context (throws if no org selected)
 */
export function useRequireOrganization() {
  const context = useOrganization()
  if (!context.currentOrganization) {
    throw new Error('No organization selected')
  }
  return context
}

/**
 * Hook to check specific permission
 */
export function useOrganizationPermission(
  permission: keyof OrganizationPermissions
): boolean {
  const { permissions } = useOrganization()
  return permissions[permission]
}
