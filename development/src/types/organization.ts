/**
 * Organization Types
 * Defines interfaces for multi-tenant organization management
 */

export type OrganizationRole = 'owner' | 'admin' | 'billing' | 'member' | 'viewer'

export interface OrganizationSettings {
  branding?: {
    logo_url?: string
    primary_color?: string
    secondary_color?: string
    accent_color?: string
  }
  login_page?: {
    background_url?: string
    background_color?: string
    background_fit?: 'cover' | 'contain' | 'fill' | 'center'
    headline?: string
    subtitle?: string
    card_opacity?: number
    show_logo?: boolean
    enhance_bg?: boolean
    show_animated_bg?: boolean
  }
  theme?: 'light' | 'dark' | 'auto'
  display_name?: string
  timezone?: string
  date_format?: string
  /** Maps device_type strings to their uploaded image URLs */
  device_type_images?: Record<string, string>
  [key: string]: unknown
}

export type SubscriptionTier =
  | 'free'
  | 'starter'
  | 'professional'
  | 'reseller'
  | 'enterprise'

export const RESELLER_TIERS: SubscriptionTier[] = ['reseller', 'enterprise']

export interface Organization {
  id: string
  name: string
  slug: string
  description?: string
  subscription_tier?: SubscriptionTier
  is_active: boolean
  settings?: OrganizationSettings
  parent_organization_id?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
  owner_id?: string
}

/**
 * Check if an organization has reseller privileges (can create/manage child orgs)
 */
export function isResellerOrg(org: Organization | null | undefined): boolean {
  if (!org?.subscription_tier) return false
  return RESELLER_TIERS.includes(org.subscription_tier as SubscriptionTier)
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: OrganizationRole
  permissions?: string[]
  invited_by?: string
  joined_at: string
  created_at: string
  updated_at: string
  /** When temporary membership expires (null = permanent) */
  expires_at?: string
  /** Whether this is a temporary cross-org access grant */
  is_temporary?: boolean
}

export interface UserOrganization extends Organization {
  // User's role in this organization
  role: OrganizationRole
  // Membership details
  membershipId: string
  joinedAt: string
  // Quick stats
  deviceCount?: number
  userCount?: number
  activeAlertsCount?: number
}

export interface OrganizationPermissions {
  canManageMembers: boolean
  canInviteMembers: boolean
  canRemoveMembers: boolean
  canManageDevices: boolean
  canManageLocations: boolean
  canManageIntegrations: boolean
  canConfigureAlerts: boolean
  canViewBilling: boolean
  canManageBilling: boolean
  canUpdateSettings: boolean
  canDeleteOrganization: boolean
  canViewAuditLogs: boolean
}

export interface OrganizationStats {
  totalDevices: number
  onlineDevices: number
  totalUsers: number
  activeAlerts: number
  totalLocations: number
  activeIntegrations: number
}

/**
 * Calculate permissions based on organization role
 */
export function getOrganizationPermissions(
  role: OrganizationRole
): OrganizationPermissions {
  switch (role) {
    case 'owner':
      return {
        canManageMembers: true,
        canInviteMembers: true,
        canRemoveMembers: true,
        canManageDevices: true,
        canManageLocations: true,
        canManageIntegrations: true,
        canConfigureAlerts: true,
        canViewBilling: true,
        canManageBilling: true,
        canUpdateSettings: true,
        canDeleteOrganization: true,
        canViewAuditLogs: true,
      }
    case 'admin':
      return {
        canManageMembers: true,
        canInviteMembers: true,
        canRemoveMembers: true,
        canManageDevices: true,
        canManageLocations: true,
        canManageIntegrations: true,
        canConfigureAlerts: true,
        canViewBilling: true,
        canManageBilling: false,
        canUpdateSettings: false,
        canDeleteOrganization: false,
        canViewAuditLogs: true,
      }
    case 'member':
      return {
        canManageMembers: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canManageDevices: true,
        canManageLocations: false,
        canManageIntegrations: false,
        canConfigureAlerts: true,
        canViewBilling: false,
        canManageBilling: false,
        canUpdateSettings: false,
        canDeleteOrganization: false,
        canViewAuditLogs: false,
      }
    case 'billing':
      return {
        canManageMembers: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canManageDevices: false,
        canManageLocations: false,
        canManageIntegrations: false,
        canConfigureAlerts: false,
        canViewBilling: true,
        canManageBilling: true,
        canUpdateSettings: false,
        canDeleteOrganization: false,
        canViewAuditLogs: false,
      }
    case 'viewer':
      return {
        canManageMembers: false,
        canInviteMembers: false,
        canRemoveMembers: false,
        canManageDevices: false,
        canManageLocations: false,
        canManageIntegrations: false,
        canConfigureAlerts: false,
        canViewBilling: false,
        canManageBilling: false,
        canUpdateSettings: false,
        canDeleteOrganization: false,
        canViewAuditLogs: false,
      }
  }
}

/**
 * Get role display properties
 */
export function getRoleDisplayInfo(role: OrganizationRole): {
  label: string
  color: string
  description: string
} {
  switch (role) {
    case 'owner':
      return {
        label: 'Owner',
        color: 'purple',
        description: 'Full control including billing and deletion',
      }
    case 'admin':
      return {
        label: 'Admin',
        color: 'blue',
        description: 'Manage members, devices, and integrations',
      }
    case 'billing':
      return {
        label: 'Billing',
        color: 'amber',
        description: 'View and manage billing and invoices',
      }
    case 'member':
      return {
        label: 'Member',
        color: 'green',
        description: 'Manage devices and create alerts',
      }
    case 'viewer':
      return {
        label: 'Viewer',
        color: 'gray',
        description: 'Read-only access to organization data',
      }
  }
}
