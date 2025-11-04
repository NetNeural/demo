/**
 * REAL UNIT TESTS - Testing Actual Source Code
 * Tests for src/lib/permissions.ts permission functions
 */

import {
  canViewAllOrganizations,
  canCreateOrganization,
  canManageOrganization,
  canDeleteOrganization,
  canViewAllUsers,
  canManageUser,
  canInviteUser,
  canDeleteUser,
  canViewDevices,
  canCreateDevice,
  canEditDevice,
  canDeleteDevice,
  canViewPlatformAnalytics,
  canViewOrganizationAnalytics,
  canConfigureGlobalSettings,
  canConfigureOrganizationSettings,
  canManageIntegrations,
  canAccessOrganization,
  getAccessibleOrganizations,
  hasAnyRole,
  hasMinimumRole,
} from '@/lib/permissions'
import type { UserProfile } from '@/lib/auth'

describe('Permissions Module - Real Source Code Tests', () => {
  // Test user profiles
  const superAdmin: UserProfile = {
    id: 'super-1',
    email: 'super@example.com',
    role: 'super_admin',
    isSuperAdmin: true,
    organizationId: null,
    organizationName: null,
  }

  const orgOwner: UserProfile = {
    id: 'owner-1',
    email: 'owner@example.com',
    role: 'org_owner',
    isSuperAdmin: false,
    organizationId: 'org-123',
    organizationName: 'Test Org',
  }

  const orgAdmin: UserProfile = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'org_admin',
    isSuperAdmin: false,
    organizationId: 'org-123',
    organizationName: 'Test Org',
  }

  const regularUser: UserProfile = {
    id: 'user-1',
    email: 'user@example.com',
    role: 'user',
    isSuperAdmin: false,
    organizationId: 'org-123',
    organizationName: 'Test Org',
  }

  const viewer: UserProfile = {
    id: 'viewer-1',
    email: 'viewer@example.com',
    role: 'viewer',
    isSuperAdmin: false,
    organizationId: 'org-123',
    organizationName: 'Test Org',
  }

  describe('Organization Management Permissions', () => {
    describe('canViewAllOrganizations', () => {
      test('super admin can view all organizations', () => {
        expect(canViewAllOrganizations(superAdmin)).toBe(true)
      })

      test('org owner cannot view all organizations', () => {
        expect(canViewAllOrganizations(orgOwner)).toBe(false)
      })

      test('null user cannot view all organizations', () => {
        expect(canViewAllOrganizations(null)).toBe(false)
      })
    })

    describe('canCreateOrganization', () => {
      test('super admin can create organizations', () => {
        expect(canCreateOrganization(superAdmin)).toBe(true)
      })

      test('org owner cannot create organizations', () => {
        expect(canCreateOrganization(orgOwner)).toBe(false)
      })

      test('null user cannot create organizations', () => {
        expect(canCreateOrganization(null)).toBe(false)
      })
    })

    describe('canManageOrganization', () => {
      test('super admin can manage any organization', () => {
        expect(canManageOrganization(superAdmin, 'any-org')).toBe(true)
      })

      test('org owner can manage their own organization', () => {
        expect(canManageOrganization(orgOwner, 'org-123')).toBe(true)
      })

      test('org owner cannot manage other organizations', () => {
        expect(canManageOrganization(orgOwner, 'other-org')).toBe(false)
      })

      test('null user cannot manage organizations', () => {
        expect(canManageOrganization(null, 'org-123')).toBe(false)
      })
    })

    describe('canDeleteOrganization', () => {
      test('super admin can delete organizations', () => {
        expect(canDeleteOrganization(superAdmin)).toBe(true)
      })

      test('org owner cannot delete organizations', () => {
        expect(canDeleteOrganization(orgOwner)).toBe(false)
      })

      test('null user cannot delete organizations', () => {
        expect(canDeleteOrganization(null)).toBe(false)
      })
    })
  })

  describe('User Management Permissions', () => {
    describe('canViewAllUsers', () => {
      test('super admin can view all users', () => {
        expect(canViewAllUsers(superAdmin)).toBe(true)
      })

      test('org owner cannot view all users', () => {
        expect(canViewAllUsers(orgOwner)).toBe(false)
      })

      test('null user cannot view all users', () => {
        expect(canViewAllUsers(null)).toBe(false)
      })
    })

    describe('canManageUser', () => {
      test('super admin can manage any user', () => {
        expect(canManageUser(superAdmin, 'any-org')).toBe(true)
      })

      test('org owner can manage users in their organization', () => {
        expect(canManageUser(orgOwner, 'org-123')).toBe(true)
      })

      test('org owner cannot manage users in other organizations', () => {
        expect(canManageUser(orgOwner, 'other-org')).toBe(false)
      })

      test('user without organization cannot manage users', () => {
        const userWithoutOrg = { ...regularUser, organizationId: null }
        expect(canManageUser(userWithoutOrg, 'org-123')).toBe(false)
      })

      test('null user cannot manage users', () => {
        expect(canManageUser(null, 'org-123')).toBe(false)
      })

      test('cannot manage users without target org', () => {
        expect(canManageUser(orgOwner, null)).toBe(false)
      })
    })

    describe('canInviteUser', () => {
      test('super admin can invite users', () => {
        expect(canInviteUser(superAdmin)).toBe(true)
      })

      test('org owner can invite users', () => {
        expect(canInviteUser(orgOwner)).toBe(true)
      })

      test('org admin can invite users', () => {
        expect(canInviteUser(orgAdmin)).toBe(true)
      })

      test('regular user cannot invite users', () => {
        expect(canInviteUser(regularUser)).toBe(false)
      })

      test('null user cannot invite users', () => {
        expect(canInviteUser(null)).toBe(false)
      })
    })

    describe('canDeleteUser', () => {
      test('super admin can delete users', () => {
        expect(canDeleteUser(superAdmin)).toBe(true)
      })

      test('org owner can delete users', () => {
        expect(canDeleteUser(orgOwner)).toBe(true)
      })

      test('org admin can delete users', () => {
        expect(canDeleteUser(orgAdmin)).toBe(true)
      })

      test('regular user cannot delete users', () => {
        expect(canDeleteUser(regularUser)).toBe(false)
      })

      test('null user cannot delete users', () => {
        expect(canDeleteUser(null)).toBe(false)
      })
    })
  })

  describe('Device Management Permissions', () => {
    describe('canViewDevices', () => {
      test('any authenticated user can view devices', () => {
        expect(canViewDevices(superAdmin)).toBe(true)
        expect(canViewDevices(orgOwner)).toBe(true)
        expect(canViewDevices(orgAdmin)).toBe(true)
        expect(canViewDevices(regularUser)).toBe(true)
        expect(canViewDevices(viewer)).toBe(true)
      })

      test('null user cannot view devices', () => {
        expect(canViewDevices(null)).toBe(false)
      })
    })

    describe('canCreateDevice', () => {
      test('super admin can create devices', () => {
        expect(canCreateDevice(superAdmin)).toBe(true)
      })

      test('org owner can create devices', () => {
        expect(canCreateDevice(orgOwner)).toBe(true)
      })

      test('org admin can create devices', () => {
        expect(canCreateDevice(orgAdmin)).toBe(true)
      })

      test('regular user can create devices', () => {
        expect(canCreateDevice(regularUser)).toBe(true)
      })

      test('viewer cannot create devices', () => {
        expect(canCreateDevice(viewer)).toBe(false)
      })

      test('null user cannot create devices', () => {
        expect(canCreateDevice(null)).toBe(false)
      })
    })

    describe('canEditDevice', () => {
      test('super admin can edit devices', () => {
        expect(canEditDevice(superAdmin)).toBe(true)
      })

      test('org owner can edit devices', () => {
        expect(canEditDevice(orgOwner)).toBe(true)
      })

      test('org admin can edit devices', () => {
        expect(canEditDevice(orgAdmin)).toBe(true)
      })

      test('regular user can edit devices', () => {
        expect(canEditDevice(regularUser)).toBe(true)
      })

      test('viewer cannot edit devices', () => {
        expect(canEditDevice(viewer)).toBe(false)
      })

      test('null user cannot edit devices', () => {
        expect(canEditDevice(null)).toBe(false)
      })
    })

    describe('canDeleteDevice', () => {
      test('super admin can delete devices', () => {
        expect(canDeleteDevice(superAdmin)).toBe(true)
      })

      test('org owner can delete devices', () => {
        expect(canDeleteDevice(orgOwner)).toBe(true)
      })

      test('org admin can delete devices', () => {
        expect(canDeleteDevice(orgAdmin)).toBe(true)
      })

      test('regular user cannot delete devices', () => {
        expect(canDeleteDevice(regularUser)).toBe(false)
      })

      test('viewer cannot delete devices', () => {
        expect(canDeleteDevice(viewer)).toBe(false)
      })

      test('null user cannot delete devices', () => {
        expect(canDeleteDevice(null)).toBe(false)
      })
    })
  })

  describe('Analytics & Reporting Permissions', () => {
    describe('canViewPlatformAnalytics', () => {
      test('super admin can view platform analytics', () => {
        expect(canViewPlatformAnalytics(superAdmin)).toBe(true)
      })

      test('org owner cannot view platform analytics', () => {
        expect(canViewPlatformAnalytics(orgOwner)).toBe(false)
      })

      test('null user cannot view platform analytics', () => {
        expect(canViewPlatformAnalytics(null)).toBe(false)
      })
    })

    describe('canViewOrganizationAnalytics', () => {
      test('super admin can view organization analytics', () => {
        expect(canViewOrganizationAnalytics(superAdmin)).toBe(true)
      })

      test('org owner can view organization analytics', () => {
        expect(canViewOrganizationAnalytics(orgOwner)).toBe(true)
      })

      test('org admin can view organization analytics', () => {
        expect(canViewOrganizationAnalytics(orgAdmin)).toBe(true)
      })

      test('regular user cannot view organization analytics', () => {
        expect(canViewOrganizationAnalytics(regularUser)).toBe(false)
      })

      test('null user cannot view organization analytics', () => {
        expect(canViewOrganizationAnalytics(null)).toBe(false)
      })
    })
  })

  describe('Settings Permissions', () => {
    describe('canConfigureGlobalSettings', () => {
      test('super admin can configure global settings', () => {
        expect(canConfigureGlobalSettings(superAdmin)).toBe(true)
      })

      test('org owner cannot configure global settings', () => {
        expect(canConfigureGlobalSettings(orgOwner)).toBe(false)
      })

      test('null user cannot configure global settings', () => {
        expect(canConfigureGlobalSettings(null)).toBe(false)
      })
    })

    describe('canConfigureOrganizationSettings', () => {
      test('super admin can configure organization settings', () => {
        expect(canConfigureOrganizationSettings(superAdmin)).toBe(true)
      })

      test('org owner can configure organization settings', () => {
        expect(canConfigureOrganizationSettings(orgOwner)).toBe(true)
      })

      test('org admin cannot configure organization settings', () => {
        expect(canConfigureOrganizationSettings(orgAdmin)).toBe(false)
      })

      test('null user cannot configure organization settings', () => {
        expect(canConfigureOrganizationSettings(null)).toBe(false)
      })
    })

    describe('canManageIntegrations', () => {
      test('super admin can manage integrations', () => {
        expect(canManageIntegrations(superAdmin)).toBe(true)
      })

      test('org owner can manage integrations', () => {
        expect(canManageIntegrations(orgOwner)).toBe(true)
      })

      test('org admin can manage integrations', () => {
        expect(canManageIntegrations(orgAdmin)).toBe(true)
      })

      test('regular user cannot manage integrations', () => {
        expect(canManageIntegrations(regularUser)).toBe(false)
      })

      test('null user cannot manage integrations', () => {
        expect(canManageIntegrations(null)).toBe(false)
      })
    })
  })

  describe('Organization Access', () => {
    describe('canAccessOrganization', () => {
      test('super admin can access any organization', () => {
        expect(canAccessOrganization(superAdmin, 'any-org')).toBe(true)
      })

      test('org owner can access their organization', () => {
        expect(canAccessOrganization(orgOwner, 'org-123')).toBe(true)
      })

      test('org owner cannot access other organizations', () => {
        expect(canAccessOrganization(orgOwner, 'other-org')).toBe(false)
      })

      test('null user cannot access organizations', () => {
        expect(canAccessOrganization(null, 'org-123')).toBe(false)
      })
    })

    describe('getAccessibleOrganizations', () => {
      test('super admin can access all organizations', () => {
        expect(getAccessibleOrganizations(superAdmin)).toBe('all')
      })

      test('org owner can access their organization', () => {
        expect(getAccessibleOrganizations(orgOwner)).toBe('org-123')
      })

      test('null user cannot access any organizations', () => {
        expect(getAccessibleOrganizations(null)).toBe(null)
      })
    })
  })

  describe('Role Helper Functions', () => {
    describe('hasAnyRole', () => {
      test('should return true when user has one of the roles', () => {
        expect(hasAnyRole(orgOwner, ['org_owner', 'org_admin'])).toBe(true)
        expect(hasAnyRole(orgAdmin, ['org_owner', 'org_admin'])).toBe(true)
        expect(hasAnyRole(regularUser, ['user', 'viewer'])).toBe(true)
      })

      test('should return false when user does not have any of the roles', () => {
        expect(hasAnyRole(regularUser, ['org_owner', 'org_admin'])).toBe(false)
        expect(hasAnyRole(viewer, ['user', 'org_admin'])).toBe(false)
      })

      test('should return false for null user', () => {
        expect(hasAnyRole(null, ['org_owner'])).toBe(false)
      })
    })

    describe('hasMinimumRole', () => {
      test('should return true when user has minimum role or higher', () => {
        expect(hasMinimumRole(superAdmin, 'viewer')).toBe(true)
        expect(hasMinimumRole(orgOwner, 'user')).toBe(true)
        expect(hasMinimumRole(orgAdmin, 'org_admin')).toBe(true)
        expect(hasMinimumRole(regularUser, 'viewer')).toBe(true)
      })

      test('should return false when user has lower role', () => {
        expect(hasMinimumRole(viewer, 'user')).toBe(false)
        expect(hasMinimumRole(regularUser, 'org_admin')).toBe(false)
        expect(hasMinimumRole(orgAdmin, 'org_owner')).toBe(false)
      })

      test('should return true for exact role match', () => {
        expect(hasMinimumRole(viewer, 'viewer')).toBe(true)
        expect(hasMinimumRole(regularUser, 'user')).toBe(true)
        expect(hasMinimumRole(orgAdmin, 'org_admin')).toBe(true)
        expect(hasMinimumRole(orgOwner, 'org_owner')).toBe(true)
      })

      test('should return false for null user', () => {
        expect(hasMinimumRole(null, 'viewer')).toBe(false)
      })
    })
  })

  describe('Edge Cases and Security Tests', () => {
    test('super admin with null organizationId still has full access', () => {
      expect(canManageOrganization(superAdmin, 'any-org')).toBe(true)
      expect(canAccessOrganization(superAdmin, 'any-org')).toBe(true)
    })

    test('user without organizationId has limited access', () => {
      const userWithoutOrg = { ...regularUser, organizationId: null }
      expect(canManageUser(userWithoutOrg, 'org-123')).toBe(false)
    })

    test('all permission functions handle null user gracefully', () => {
      expect(canViewAllOrganizations(null)).toBe(false)
      expect(canCreateDevice(null)).toBe(false)
      expect(canInviteUser(null)).toBe(false)
      expect(canViewPlatformAnalytics(null)).toBe(false)
    })

    test('viewer role has most restricted permissions', () => {
      expect(canViewDevices(viewer)).toBe(true) // Can view
      expect(canCreateDevice(viewer)).toBe(false) // Cannot create
      expect(canEditDevice(viewer)).toBe(false) // Cannot edit
      expect(canDeleteDevice(viewer)).toBe(false) // Cannot delete
    })
  })
})
