'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';
import { edgeFunctions } from '@/lib/edge-functions/client';
import type { 
  UserOrganization, 
  OrganizationPermissions, 
  OrganizationRole,
  OrganizationStats 
} from '@/types/organization';
import { getOrganizationPermissions, isResellerOrg } from '@/types/organization';

interface OrganizationContextType {
  // Current organization
  currentOrganization: UserOrganization | null;
  
  // All user's organizations
  userOrganizations: UserOrganization[];
  
  // Loading states
  isLoading: boolean;
  isLoadingStats: boolean;
  
  // Organization stats
  stats: OrganizationStats | null;
  
  // Actions
  switchOrganization: (organizationId: string) => void;
  refreshOrganizations: () => Promise<void>;
  refreshStats: () => Promise<void>;
  
  // Permissions (computed from current org role)
  permissions: OrganizationPermissions;
  
  // User's role in current organization
  userRole: OrganizationRole | null;
  
  // Convenience checks
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isViewer: boolean;
  canManageMembers: boolean;
  canManageDevices: boolean;
  canManageIntegrations: boolean;
  
  // Reseller capabilities
  isReseller: boolean;
  canCreateChildOrgs: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

interface OrganizationProviderProps {
  children: React.ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const { user } = useUser();
  
  // Initialize from localStorage immediately
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('netneural_current_org');
    }
    return null;
  });
  
  const [userOrganizations, setUserOrganizations] = useState<UserOrganization[]>([]);
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Fetch user's organizations
  const fetchUserOrganizations = useCallback(async () => {
    if (!user?.id) {
      setUserOrganizations([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Supabase URL is now handled dynamically in the config
      // No need to check env variable here since config.ts handles it

      // Fetch organizations using edge function client
      const response = await edgeFunctions.organizations.list();

      if (!response.success || !response.data) {
        console.error('Failed to fetch organizations:', response.error);
        setUserOrganizations([]);
        setIsLoading(false);
        return;
      }

      const data = response.data;
      
      console.log('🏢 Organizations data received:', {
        count: data.organizations?.length,
        isSuperAdmin: data.isSuperAdmin,
      });
      
      // Transform API response to UserOrganization format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const organizations: UserOrganization[] = (data.organizations as any[] || []).map((org: any) => {
        console.log(`🏢 Org: ${org.name} - userCount: ${org.userCount}, deviceCount: ${org.deviceCount}`);
        return {
          id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        subscription_tier: org.subscriptionTier,
        is_active: org.isActive,
        settings: org.settings, // Include settings (branding, theme, etc.)
        parent_organization_id: org.parentOrganizationId || null,
        created_by: org.createdBy || null,
        role: data.isSuperAdmin ? 'owner' : 'admin', // TODO: Get actual role from organization_members
        membershipId: `mem-${org.id}`,
        joinedAt: org.createdAt,
        created_at: org.createdAt,
        updated_at: org.updatedAt,
        deviceCount: org.deviceCount,
        userCount: org.userCount,
        activeAlertsCount: org.alertCount,
      };
      });

      setUserOrganizations(organizations);

      // Auto-select first org if none selected AND none saved in localStorage
      const savedOrgId = localStorage.getItem('netneural_current_org');
      
      console.log('🔍 Organization auto-selection:', {
        savedOrgId,
        currentOrgId,
        organizationsCount: organizations.length,
        firstOrgId: organizations[0]?.id,
        firstOrgName: organizations[0]?.name
      });
      
      if (!savedOrgId && organizations.length > 0 && organizations[0]) {
        // No saved org, select first one
        console.log('✅ Auto-selecting first organization:', organizations[0].name);
        setCurrentOrgId(organizations[0].id);
        localStorage.setItem('netneural_current_org', organizations[0].id);
      } else if (savedOrgId && organizations.some(org => org.id === savedOrgId)) {
        // Ensure the saved org is set
        console.log('✅ Using saved organization:', savedOrgId);
        setCurrentOrgId(savedOrgId);
      } else if (savedOrgId && organizations.length > 0 && organizations[0]) {
        // Saved org not found, select first available
        console.log('⚠️ Saved org not found, selecting first available:', organizations[0].name);
        setCurrentOrgId(organizations[0].id);
        localStorage.setItem('netneural_current_org', organizations[0].id);
      } else if (!currentOrgId && organizations.length > 0 && organizations[0]) {
        // Edge case: currentOrgId is null but we have orgs - force selection
        console.log('🔧 Force-selecting first organization:', organizations[0].name);
        setCurrentOrgId(organizations[0].id);
        localStorage.setItem('netneural_current_org', organizations[0].id);
      }
    } catch (error) {
      console.error('Error fetching user organizations:', error);
      setUserOrganizations([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, currentOrgId]);

  // Fetch organization stats
  const fetchOrganizationStats = useCallback(async () => {
    if (!currentOrgId) {
      setStats(null);
      return;
    }

    try {
      setIsLoadingStats(true);
      
      console.log('📊 Fetching stats for organization:', currentOrgId);
      
      // Fetch dashboard stats using edge function client
      const response = await edgeFunctions.organizations.stats(currentOrgId);

      console.log('📊 Stats response:', { success: response.success, hasData: !!response.data, error: response.error });

      if (!response.success || !response.data) {
        // Only log error if we're authenticated (not on login page)
        if (user) {
          console.error('Failed to fetch stats:', response.error);
        }
        setStats(null);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const statsData = response.data as any;
      
      console.log('📊 Stats data received:', {
        totalDevices: statsData.totalDevices,
        totalUsers: statsData.totalUsers,
        activeAlerts: statsData.activeAlerts,
      });
      
      const fetchedStats: OrganizationStats = {
        totalDevices: statsData.totalDevices || 0,
        onlineDevices: statsData.onlineDevices || 0,
        totalUsers: statsData.totalUsers || 0,
        activeAlerts: statsData.activeAlerts || 0,
        totalLocations: statsData.totalLocations || 0,
        activeIntegrations: statsData.activeIntegrations || 0,
      };

      console.log('📊 Final stats:', fetchedStats);
      setStats(fetchedStats);
    } catch (error) {
      console.error('Error fetching organization stats:', error);
      // Fall back to cached data from userOrganizations
      const currentOrg = userOrganizations.find(org => org.id === currentOrgId);
      if (currentOrg) {
        console.log('📊 Using fallback stats from cached org data:', {
          userCount: currentOrg.userCount,
          deviceCount: currentOrg.deviceCount,
        });
        setStats({
          totalDevices: currentOrg.deviceCount || 0,
          onlineDevices: Math.floor((currentOrg.deviceCount || 0) * 0.85),
          totalUsers: currentOrg.userCount || 0,
          activeAlerts: currentOrg.activeAlertsCount || 0,
          totalLocations: 0,
          activeIntegrations: 0,
        });
      } else {
        setStats(null);
      }
    } finally {
      setIsLoadingStats(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);  // Only depend on currentOrgId to prevent infinite loop from userOrganizations updates

  // Load organizations on mount or user change
  useEffect(() => {
    fetchUserOrganizations();
  }, [fetchUserOrganizations]);

  // Load stats when organization changes
  useEffect(() => {
    fetchOrganizationStats();
  }, [fetchOrganizationStats]);

  // Validate saved organization when organizations load
  useEffect(() => {
    if (userOrganizations.length > 0 && currentOrgId) {
      // Check if saved org is still valid
      const orgExists = userOrganizations.some(org => org.id === currentOrgId);
      if (!orgExists && userOrganizations[0]) {
        // If saved org doesn't exist, select first available
        setCurrentOrgId(userOrganizations[0].id);
        localStorage.setItem('netneural_current_org', userOrganizations[0].id);
      }
    }
  }, [userOrganizations, currentOrgId]);

  // Switch organization
  const switchOrganization = useCallback((organizationId: string) => {
    const org = userOrganizations.find(o => o.id === organizationId);
    if (org) {
      setCurrentOrgId(organizationId);
      localStorage.setItem('netneural_current_org', organizationId);
      setStats(null); // Clear stats while loading new org
    }
  }, [userOrganizations]);

  // Get current organization
  const currentOrganization = useMemo(() => {
    return userOrganizations.find(org => org.id === currentOrgId) || null;
  }, [userOrganizations, currentOrgId]);

  // Get user's role in current organization
  const userRole = useMemo(() => {
    return currentOrganization?.role || null;
  }, [currentOrganization]);

  // Calculate permissions based on role
  const permissions = useMemo(() => {
    if (!userRole) {
      return getOrganizationPermissions('viewer');
    }
    return getOrganizationPermissions(userRole);
  }, [userRole]);

  // Convenience role checks
  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'admin';
  const isMember = userRole === 'member';
  const isViewer = userRole === 'viewer';
  
  // Reseller checks
  const isReseller = isResellerOrg(currentOrganization);
  const canCreateChildOrgs = isReseller && (isOwner || isAdmin);

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
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

/**
 * Hook to access organization context
 * Must be used within OrganizationProvider
 */
export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}

/**
 * Hook to require organization context (throws if no org selected)
 */
export function useRequireOrganization() {
  const context = useOrganization();
  if (!context.currentOrganization) {
    throw new Error('No organization selected');
  }
  return context;
}

/**
 * Hook to check specific permission
 */
export function useOrganizationPermission(permission: keyof OrganizationPermissions): boolean {
  const { permissions } = useOrganization();
  return permissions[permission];
}
