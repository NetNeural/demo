import { UserProfile } from './auth'

/**
 * Permission helpers for role-based access control
 */

// Organization Management
export function canViewAllOrganizations(user: UserProfile | null): boolean {
  return user?.isSuperAdmin || false
}

export function canCreateOrganization(user: UserProfile | null): boolean {
  return user?.isSuperAdmin || false
}

export function canManageOrganization(user: UserProfile | null, orgId: string): boolean {
  if (!user) return false
  return user.isSuperAdmin || user.organizationId === orgId
}

export function canDeleteOrganization(user: UserProfile | null): boolean {
  return user?.isSuperAdmin || false
}

// User Management
export function canViewAllUsers(user: UserProfile | null): boolean {
  return user?.isSuperAdmin || false
}

export function canManageUser(user: UserProfile | null, targetOrgId: string | null): boolean {
  if (!user) return false
  if (user.isSuperAdmin) return true
  if (!targetOrgId || !user.organizationId) return false
  return user.organizationId === targetOrgId
}

export function canInviteUser(user: UserProfile | null): boolean {
  if (!user) return false
  return user.isSuperAdmin || user.role === 'org_owner' || user.role === 'org_admin'
}

export function canDeleteUser(user: UserProfile | null): boolean {
  if (!user) return false
  return user.isSuperAdmin || user.role === 'org_owner' || user.role === 'org_admin'
}

// Device Management
export function canViewDevices(user: UserProfile | null): boolean {
  return !!user // Any authenticated user
}

export function canCreateDevice(user: UserProfile | null): boolean {
  if (!user) return false
  return user.isSuperAdmin || ['org_owner', 'org_admin', 'user'].includes(user.role)
}

export function canEditDevice(user: UserProfile | null): boolean {
  if (!user) return false
  return user.isSuperAdmin || ['org_owner', 'org_admin', 'user'].includes(user.role)
}

export function canDeleteDevice(user: UserProfile | null): boolean {
  if (!user) return false
  return user.isSuperAdmin || ['org_owner', 'org_admin'].includes(user.role)
}

// Analytics & Reporting
export function canViewPlatformAnalytics(user: UserProfile | null): boolean {
  return user?.isSuperAdmin || false
}

export function canViewOrganizationAnalytics(user: UserProfile | null): boolean {
  if (!user) return false
  return user.isSuperAdmin || ['org_owner', 'org_admin'].includes(user.role)
}

// Settings
export function canConfigureGlobalSettings(user: UserProfile | null): boolean {
  return user?.isSuperAdmin || false
}

export function canConfigureOrganizationSettings(user: UserProfile | null): boolean {
  if (!user) return false
  return user.isSuperAdmin || user.role === 'org_owner'
}

export function canManageIntegrations(user: UserProfile | null): boolean {
  if (!user) return false
  return user.isSuperAdmin || ['org_owner', 'org_admin'].includes(user.role)
}

// Organization Access
export function canAccessOrganization(user: UserProfile | null, orgId: string): boolean {
  if (!user) return false
  return user.isSuperAdmin || user.organizationId === orgId
}

export function getAccessibleOrganizations(user: UserProfile | null): 'all' | string | null {
  if (!user) return null
  if (user.isSuperAdmin) return 'all'
  return user.organizationId
}

// Helper to check if user has any of the given roles
export function hasAnyRole(user: UserProfile | null, roles: UserProfile['role'][]): boolean {
  if (!user) return false
  return roles.includes(user.role)
}

// Helper to check minimum role level
export function hasMinimumRole(user: UserProfile | null, minRole: UserProfile['role']): boolean {
  if (!user) return false
  
  const roleHierarchy: UserProfile['role'][] = [
    'viewer',
    'user',
    'org_admin',
    'org_owner',
    'super_admin'
  ]
  
  const userLevel = roleHierarchy.indexOf(user.role)
  const minLevel = roleHierarchy.indexOf(minRole)
  
  return userLevel >= minLevel
}
