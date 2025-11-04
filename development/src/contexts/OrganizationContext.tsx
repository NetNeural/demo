'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';
import { handleApiError } from '@/lib/api-error-handler';
import type { 
  UserOrganization, 
  OrganizationPermissions, 
  OrganizationRole,
  OrganizationStats 
} from '@/types/organization';
import { getOrganizationPermissions } from '@/types/organization';

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
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Missing Supabase configuration');
      }

      // Get session token for authenticated API calls
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.error('No active session');
        setUserOrganizations([]);
        setIsLoading(false);
        return;
      }

      // Fetch organizations from edge function
      const response = await fetch(`${supabaseUrl}/functions/v1/organizations`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const errorResult = handleApiError(response, {
        errorPrefix: 'Failed to fetch organizations',
        throwOnError: false,
      });

      if (errorResult.isAuthError) {
        setUserOrganizations([]);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        setUserOrganizations([]);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      
      // Transform API response to UserOrganization format
      const organizations: UserOrganization[] = data.organizations?.map((org: {
        id: string;
        name: string;
        slug: string;
        description?: string;
        subscriptionTier?: string;
        isActive: boolean;
        userCount: number;
        deviceCount: number;
        alertCount: number;
        createdAt: string;
        updatedAt: string;
      }) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        subscriptionTier: org.subscriptionTier,
        is_active: org.isActive,
        role: data.isSuperAdmin ? 'owner' : 'admin', // TODO: Get actual role from organization_members
        membershipId: `mem-${org.id}`,
        joinedAt: org.createdAt,
        created_at: org.createdAt,
        updated_at: org.updatedAt,
        deviceCount: org.deviceCount,
        userCount: org.userCount,
        activeAlertsCount: org.alertCount,
      })) || [];

      setUserOrganizations(organizations);

      // Auto-select first org if none selected AND none saved in localStorage
      const savedOrgId = localStorage.getItem('netneural_current_org');
      if (!savedOrgId && organizations.length > 0 && organizations[0]) {
        setCurrentOrgId(organizations[0].id);
        localStorage.setItem('netneural_current_org', organizations[0].id);
      } else if (savedOrgId && organizations.some(org => org.id === savedOrgId)) {
        // Ensure the saved org is set
        setCurrentOrgId(savedOrgId);
      } else if (savedOrgId && organizations.length > 0 && organizations[0]) {
        // Saved org not found, select first available
        setCurrentOrgId(organizations[0].id);
        localStorage.setItem('netneural_current_org', organizations[0].id);
      }
    } catch (error) {
      console.error('Error fetching user organizations:', error);
      setUserOrganizations([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Fetch organization stats
  const fetchOrganizationStats = useCallback(async () => {
    if (!currentOrgId) {
      setStats(null);
      return;
    }

    try {
      setIsLoadingStats(true);
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Missing Supabase configuration');
      }

      // Get session token
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setStats(null);
        return;
      }

      // Fetch dashboard stats from edge function
      const response = await fetch(
        `${supabaseUrl}/functions/v1/dashboard-stats?organization_id=${currentOrgId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const errorResult = handleApiError(response, {
        errorPrefix: 'Failed to fetch stats',
        throwOnError: false,
      });

      if (errorResult.isAuthError) {
        setStats(null);
        return;
      }

      if (!response.ok) {
        setStats(null);
        return;
      }

      const data = await response.json();
      
      const fetchedStats: OrganizationStats = {
        totalDevices: data.totalDevices || 0,
        onlineDevices: data.onlineDevices || 0,
        totalUsers: data.totalUsers || 0,
        activeAlerts: data.activeAlerts || 0,
        totalLocations: data.totalLocations || 0,
        activeIntegrations: data.activeIntegrations || 0,
      };

      setStats(fetchedStats);
    } catch (error) {
      console.error('Error fetching organization stats:', error);
      // Fall back to cached data from userOrganizations
      const currentOrg = userOrganizations.find(org => org.id === currentOrgId);
      if (currentOrg) {
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
  }, [currentOrgId, userOrganizations]);

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
