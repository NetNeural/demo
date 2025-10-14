'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/lib/database.types';
import { NotificationModal, useNotificationModal } from '@/components/ui/notification-modal';

type DatabaseUser = Database['public']['Tables']['users']['Row'];
type DatabaseOrganization = Database['public']['Tables']['organizations']['Row'];
type DatabaseOrganizationMember = Database['public']['Tables']['organization_members']['Row'];

export type UserProfile = DatabaseUser;
export type Organization = DatabaseOrganization;
export type OrganizationMember = DatabaseOrganizationMember & {
  organization: Organization;
};

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  organizations: OrganizationMember[];
  currentOrganization: OrganizationMember | null;
  loading: boolean;
  error: string | null;
  authError: string | null;
  switchOrganization: (organizationId: string) => void;
  refreshProfile: () => Promise<void>;
  clearAuthError: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationMember[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<OrganizationMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const { notification, showNotification, hideNotification } = useNotificationModal();

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching user profile:', profileError);
        setError('Failed to load user profile');
        return;
      }

      // If no profile exists, create one
      if (!profileData) {
        console.log('User profile not found, creating new profile for:', userId);
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser.user) {
          const { data: newProfile, error: createError } = await supabase
            .from('users')
            .insert({
              id: userId,
              email: authUser.user.email || '',
              full_name: authUser.user.user_metadata?.full_name || authUser.user.email?.split('@')[0] || 'User',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .maybeSingle();

          if (createError || !newProfile) {
            console.error('Error creating user profile:', {
              error: createError,
              code: createError?.code,
              message: createError?.message,
              details: createError?.details
            });
            showNotification(
              'error',
              'Profile Creation Failed',
              'Unable to create your user profile. This may be a temporary issue. Please try refreshing the page or contact support if the problem persists.',
              15 // Auto-close after 15 seconds
            );
            setError('Failed to create user profile');
            return;
          }

          console.log('Successfully created user profile:', newProfile);
          setProfile(newProfile);
        } else {
          // Show user-friendly modal instead of console error
          showNotification(
            'error',
            'Authentication Error',
            'No authenticated user found. Please try logging in again.',
            10 // Auto-close after 10 seconds
          );
          setError('Authentication error during profile creation');
          return;
        }
      } else {
        setProfile(profileData);
      }

      // Fetch user's organization memberships with organization details
      const { data: orgMemberships, error: orgError } = await supabase
        .from('organization_members')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', userId);

      if (orgError && orgError.code !== 'PGRST116') {
        console.error('Error fetching organizations:', orgError);
        setError('Failed to load organizations');
        return;
      }

      const memberships = (orgMemberships || []) as OrganizationMember[];
      setOrganizations(memberships);

      // Set current organization (first one for now, or from localStorage)
      const savedOrgId = localStorage.getItem('currentOrganizationId');
      let currentOrg = memberships[0] || null;
      
      if (savedOrgId && memberships.length > 0) {
        const savedOrg = memberships.find(m => m.organization_id === savedOrgId);
        if (savedOrg) currentOrg = savedOrg;
      }
      
      // If no organizations found, try to assign user to default organization
      if (memberships.length === 0) {
        console.warn('User has no organization memberships. Attempting to assign to default organization.');
        
        try {
          // Get the default organization
          const { data: defaultOrg, error: defaultOrgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('slug', 'netneural-demo')
            .maybeSingle();

          if (defaultOrgError) {
            console.error('Error querying default organization:', defaultOrgError);
            setError('Failed to access default organization. Please contact your administrator.');
            return;
          }

          if (!defaultOrg) {
            console.error('Default organization not found. Available organizations might be restricted by RLS policies.');
            setError('Default organization not found. Please contact your administrator to set up organization access.');
            return;
          }

          // Create organization membership for the user
          const membershipData = {
            organization_id: defaultOrg.id,
            user_id: userId,
            role: 'member' as const,
            joined_at: new Date().toISOString(),
            // Only include invited_by if owner_id exists
            ...(defaultOrg.owner_id && { invited_by: defaultOrg.owner_id })
          };

          console.log('Attempting to create membership with data:', membershipData);

          // Debug: Check current auth state
          const { data: { user: currentAuthUser } } = await supabase.auth.getUser();
          console.log('Current auth state during membership creation:', {
            authUserId: currentAuthUser?.id,
            targetUserId: userId,
            match: currentAuthUser?.id === userId
          });

          const { data: newMembership, error: membershipError } = await supabase
            .from('organization_members')
            .insert(membershipData)
            .select(`
              *,
              organization:organizations(*)
            `)
            .maybeSingle();

          if (membershipError) {
            console.error('Failed to create organization membership:', {
              error: membershipError,
              code: membershipError.code,
              message: membershipError.message,
              details: membershipError.details,
              hint: membershipError.hint,
              insertData: {
                organization_id: defaultOrg.id,
                user_id: userId,
                role: 'member'
              }
            });
            showNotification(
              'error',
              'Organization Access Failed',
              'Unable to assign you to the default organization. Please contact your administrator for assistance.',
              20 // Auto-close after 20 seconds
            );
            setError('Failed to assign organization access. Please contact your administrator.');
            return;
          }

          if (!newMembership) {
            console.error('Organization membership creation succeeded but returned no data');
            showNotification(
              'warning',
              'Organization Assignment Issue',
              'There was an issue setting up your organization access. Please contact support if you experience any problems.',
              15 // Auto-close after 15 seconds
            );
            setError('Failed to assign organization access. Please contact your administrator.');
            return;
          }

          // Update memberships with the new one
          const newMemberships = [newMembership] as OrganizationMember[];
          setOrganizations(newMemberships);
          currentOrg = newMemberships[0] || null;
          
          console.log('User successfully assigned to default organization');
        } catch (error) {
          console.error('Error assigning user to organization:', error);
          setError('Failed to set up organization access. Please contact your administrator.');
          return;
        }
      }
      
      setCurrentOrganization(currentOrg);
      if (currentOrg) {
        localStorage.setItem('currentOrganizationId', currentOrg.organization_id);
      }

    } catch (err) {
      console.error('Error in fetchUserProfile:', err);
      setError('Failed to load user data');
    }
  }, [supabase, showNotification]);

  const switchOrganization = (organizationId: string) => {
    const org = organizations.find(o => o.organization_id === organizationId);
    if (org) {
      setCurrentOrganization(org);
      localStorage.setItem('currentOrganizationId', organizationId);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      setLoading(true);
      await fetchUserProfile(user.id);
      setLoading(false);
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          await fetchUserProfile(session.user.id);
        }
        
        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('Auth state change:', event, session?.user?.email || 'no user');
            
            if (event === 'SIGNED_IN' && session?.user) {
              setUser(session.user);
              setAuthError(null); // Clear any previous auth errors
              await fetchUserProfile(session.user.id);
            } else if (event === 'SIGNED_OUT') {
              setUser(null);
              setProfile(null);
              setOrganizations([]);
              setCurrentOrganization(null);
              localStorage.removeItem('currentOrganizationId');
              setAuthError(null); // Clear auth errors on sign out
            } else if (event === 'SIGNED_IN' && !session?.user) {
              // Authentication attempt failed
              setAuthError('Authentication failed. Please check your credentials.');
            }
          }
        );

        unsubscribe = () => {
          subscription.unsubscribe();
        };

        setLoading(false);
      } catch (err) {
        console.error('Auth initialization error:', err);
        setError('Authentication failed');
        setLoading(false);
      }
    };

    initializeAuth();

    // Return cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [supabase.auth, fetchUserProfile]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        profile,
        organizations,
        currentOrganization,
        loading,
        error,
        authError,
        switchOrganization,
        refreshProfile,
        clearAuthError,
      }}
    >
      {children}
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={hideNotification}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        {...(notification.autoClose !== undefined && { autoClose: notification.autoClose })}
      />
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

// Helper hooks for common use cases
export function useCurrentOrganization() {
  const { currentOrganization } = useUser();
  return currentOrganization;
}

export function useIsOrgAdmin() {
  const { currentOrganization } = useUser();
  return currentOrganization?.role === 'owner' || currentOrganization?.role === 'admin';
}

export function useCanManageSettings() {
  const { profile, currentOrganization } = useUser();
  return (
    profile?.role === 'super_admin' ||
    profile?.role === 'org_admin' ||
    currentOrganization?.role === 'owner' ||
    currentOrganization?.role === 'admin'
  );
}