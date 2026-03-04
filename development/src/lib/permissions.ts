import { UserProfile } from './auth'

/**
 * The NetNeural platform org ID. Owners of this org get platform-admin
 * privileges (same as super_admin) EXCEPT organic cross-org access.
 * They can only access other orgs through the Cross-Org / request-access feature.
 */
export const NETNEURAL_ORG_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Platform admin = super_admin OR an owner of the NetNeural org.
 * Grants access to all admin features (customers, revenue, analytics,
 * global settings, etc.) but does NOT grant organic cross-org data access.
 *
 * @param orgRole  The user's role within the *current* organization context
 *                 (from OrganizationContext.userRole — 'owner' | 'admin' | …).
 *                 If omitted, falls back to checking UserProfile.role.
 */
export function isPlatformAdmin(
  user: UserProfile | null,
  currentOrgId?: string | null,
  orgRole?: string | null
): boolean {
  if (!user) return false
  if (user.isSuperAdmin) return true
  // NetNeural org owner check — supports both membership role ('owner')
  // and global role ('org_owner')
  const isNetNeuralOrg =
    currentOrgId === NETNEURAL_ORG_ID ||
    user.organizationId === NETNEURAL_ORG_ID
  const isOwnerRole =
    orgRole === 'owner' || user.role === 'org_owner'
  return isNetNeuralOrg && isOwnerRole
}

/**
 * Permission helpers for role-based access control
 */

// Organization Management
// NOTE: canViewAllOrganizations is for organic cross-org listing.
// It stays super_admin-only. Platform admins use Cross-Org feature instead.
export function canViewAllOrganizations(user: UserProfile | null): boolean {
  return user?.isSuperAdmin || false
}

export function canCreateOrganization(
  user: UserProfile | null,
  isResellerOrg?: boolean
): boolean {
  if (user?.isSuperAdmin) return true
  // Reseller org owners can create child organizations
  if (
    isResellerOrg &&
    (user?.role === 'org_owner' || user?.role === 'org_admin')
  )
    return true
  return false
}

export function canManageOrganization(
  user: UserProfile | null,
  orgId: string
): boolean {
  if (!user) return false
  return user.isSuperAdmin || user.organizationId === orgId
}

export function canDeleteOrganization(
  user: UserProfile | null,
  currentOrgId?: string | null,
  orgRole?: string | null
): boolean {
  return isPlatformAdmin(user, currentOrgId, orgRole)
}

// Reseller Management
export function canManageChildOrganizations(
  user: UserProfile | null,
  isResellerOrg?: boolean
): boolean {
  if (user?.isSuperAdmin) return true
  if (
    isResellerOrg &&
    (user?.role === 'org_owner' || user?.role === 'org_admin')
  )
    return true
  return false
}

export function canViewChildOrganizations(
  user: UserProfile | null,
  isResellerOrg?: boolean
): boolean {
  if (user?.isSuperAdmin) return true
  if (isResellerOrg && user?.role !== 'viewer') return true
  return false
}

// User Management
// NOTE: canViewAllUsers is for cross-org user listing.
// It stays super_admin-only. Platform admins see their own org users.
export function canViewAllUsers(user: UserProfile | null): boolean {
  return user?.isSuperAdmin || false
}

export function canManageUser(
  user: UserProfile | null,
  targetOrgId: string | null
): boolean {
  if (!user) return false
  if (user.isSuperAdmin) return true
  if (!targetOrgId || !user.organizationId) return false
  return user.organizationId === targetOrgId
}

export function canInviteUser(user: UserProfile | null): boolean {
  if (!user) return false
  return (
    user.isSuperAdmin || user.role === 'org_owner' || user.role === 'org_admin'
  )
}

export function canDeleteUser(user: UserProfile | null): boolean {
  if (!user) return false
  return (
    user.isSuperAdmin || user.role === 'org_owner' || user.role === 'org_admin'
  )
}

// Device Management
export function canViewDevices(user: UserProfile | null): boolean {
  return !!user // Any authenticated user
}

export function canCreateDevice(user: UserProfile | null): boolean {
  if (!user) return false
  return (
    user.isSuperAdmin || ['org_owner', 'org_admin', 'user'].includes(user.role)
  )
}

export function canEditDevice(user: UserProfile | null): boolean {
  if (!user) return false
  return (
    user.isSuperAdmin || ['org_owner', 'org_admin', 'user'].includes(user.role)
  )
}

export function canDeleteDevice(user: UserProfile | null): boolean {
  if (!user) return false
  return user.isSuperAdmin || ['org_owner', 'org_admin'].includes(user.role)
}

// Analytics & Reporting
export function canViewPlatformAnalytics(
  user: UserProfile | null,
  currentOrgId?: string | null,
  orgRole?: string | null
): boolean {
  return isPlatformAdmin(user, currentOrgId, orgRole)
}

export function canViewOrganizationAnalytics(
  user: UserProfile | null
): boolean {
  if (!user) return false
  return user.isSuperAdmin || ['org_owner', 'org_admin'].includes(user.role)
}

// Settings
export function canConfigureGlobalSettings(
  user: UserProfile | null,
  currentOrgId?: string | null,
  orgRole?: string | null
): boolean {
  return isPlatformAdmin(user, currentOrgId, orgRole)
}

export function canConfigureOrganizationSettings(
  user: UserProfile | null
): boolean {
  if (!user) return false
  return user.isSuperAdmin || user.role === 'org_owner'
}

export function canManageIntegrations(user: UserProfile | null): boolean {
  if (!user) return false
  return user.isSuperAdmin || ['org_owner', 'org_admin'].includes(user.role)
}

// Organization Access
export function canAccessOrganization(
  user: UserProfile | null,
  orgId: string
): boolean {
  if (!user) return false
  return user.isSuperAdmin || user.organizationId === orgId
}

export function getAccessibleOrganizations(
  user: UserProfile | null
): 'all' | string | null {
  if (!user) return null
  if (user.isSuperAdmin) return 'all'
  return user.organizationId
}

// Helper to check if user has any of the given roles
export function hasAnyRole(
  user: UserProfile | null,
  roles: UserProfile['role'][]
): boolean {
  if (!user) return false
  return roles.includes(user.role)
}

// Helper to check minimum role level
export function hasMinimumRole(
  user: UserProfile | null,
  minRole: UserProfile['role']
): boolean {
  if (!user) return false

  const roleHierarchy: UserProfile['role'][] = [
    'viewer',
    'user',
    'org_admin',
    'org_owner',
    'super_admin',
  ]

  const userLevel = roleHierarchy.indexOf(user.role)
  const minLevel = roleHierarchy.indexOf(minRole)

  return userLevel >= minLevel
}

// Support Page Access
// Admins and owners can access support for their organization
// Super admins can access support for any organization
export function canAccessSupport(
  user: UserProfile | null,
  organizationRole?: string | null
): boolean {
  if (!user) return false

  // Super admins always have access
  if (user.isSuperAdmin || user.role === 'super_admin') {
    return true
  }

  // Check global role (org_admin or org_owner)
  if (hasMinimumRole(user, 'org_admin')) {
    return true
  }

  // Check organization-specific role (admin or owner)
  if (organizationRole) {
    return ['admin', 'owner'].includes(organizationRole)
  }

  return false
}
