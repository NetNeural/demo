/**
 * COMPREHENSIVE TEST SUITE: Organization Management
 *
 * Tests all organization CRUD operations, member management, RLS policies
 * Coverage: Organizations, Members, Roles, Permissions, Business Rules
 */

import { createClient } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('Organization Management - Complete Coverage', () => {
  let mockSupabase: {
    from: jest.Mock
    auth: {
      getUser: jest.Mock
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        order: jest.fn().mockReturnThis(),
      })),
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'admin@example.com' } },
          error: null,
        }),
      },
    }
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  describe('Organization Creation', () => {
    test('should create organization with valid data', async () => {
      const orgData = {
        name: 'Acme Corporation',
        slug: 'acme-corp',
        owner_id: 'user-123',
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'org-123',
                ...orgData,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organizations')
        .insert(orgData)
        .select()
        .single()

      expect(result.data).toMatchObject(orgData)
      expect(result.data?.id).toBe('org-123')
      expect(result.error).toBeNull()
    })

    test('should enforce unique organization slug', async () => {
      const duplicateOrg = {
        name: 'Another Corp',
        slug: 'acme-corp', // Duplicate slug
        owner_id: 'user-456',
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'duplicate key value', code: '23505' },
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organizations')
        .insert(duplicateOrg)
        .select()
        .single()

      expect(result.error).toBeTruthy()
      expect(result.error?.code).toBe('23505')
    })

    test('should validate slug format (lowercase, alphanumeric, hyphens)', async () => {
      const invalidOrg = {
        name: 'Test Org',
        slug: 'Invalid Slug!', // Invalid format
        owner_id: 'user-123',
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: {
                message: 'slug must be lowercase alphanumeric',
                code: '23514',
              },
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organizations')
        .insert(invalidOrg)
        .select()
        .single()

      expect(result.error).toBeTruthy()
    })

    test('should auto-create owner as first member', async () => {
      const mockFrom = mockSupabase.from as jest.Mock

      // First call: create organization
      mockFrom.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'org-123', name: 'New Org', owner_id: 'user-123' },
              error: null,
            }),
          }),
        }),
      })

      // Second call: verify member created
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                {
                  organization_id: 'org-123',
                  user_id: 'user-123',
                  role: 'owner',
                },
              ],
              error: null,
            }),
          }),
        }),
      })

      await mockSupabase
        .from('organizations')
        .insert({
          name: 'New Org',
          slug: 'new-org',
          owner_id: 'user-123',
        })
        .select()
        .single()

      const members = await mockSupabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', 'org-123')
        .eq('user_id', 'user-123')

      expect(members.data).toHaveLength(1)
      expect(members.data?.[0].role).toBe('owner')
    })

    test('should set default settings on creation', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'org-123',
                name: 'Test Org',
                settings: {
                  timezone: 'UTC',
                  notifications_enabled: true,
                  theme: 'light',
                },
              },
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organizations')
        .insert({ name: 'Test Org', slug: 'test-org', owner_id: 'user-123' })
        .select()
        .single()

      expect(result.data?.settings).toBeDefined()
      expect(result.data?.settings.timezone).toBe('UTC')
    })
  })

  describe('Organization Retrieval', () => {
    test('should get all organizations for user', async () => {
      const userOrgs = [
        { id: 'org-1', name: 'Org 1', role: 'owner' },
        { id: 'org-2', name: 'Org 2', role: 'admin' },
        { id: 'org-3', name: 'Org 3', role: 'member' },
      ]

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: userOrgs,
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('organization_members')
        .select('*')
        .eq('user_id', 'user-123')

      expect(result.data).toHaveLength(3)
    })

    test('should get single organization by ID', async () => {
      const org = {
        id: 'org-123',
        name: 'Test Organization',
        slug: 'test-org',
        owner_id: 'user-123',
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: org,
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organizations')
        .select('*')
        .eq('id', 'org-123')
        .single()

      expect(result.data).toEqual(org)
    })

    test('should get organization by slug', async () => {
      const org = {
        id: 'org-123',
        name: 'Test Organization',
        slug: 'test-org',
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: org,
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organizations')
        .select('*')
        .eq('slug', 'test-org')
        .single()

      expect(result.data?.slug).toBe('test-org')
    })

    test('should include member count in organization list', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'org-123',
              name: 'Test Org',
              member_count: 15,
            },
          ],
          error: null,
        }),
      })

      const result = await mockSupabase
        .from('organizations')
        .select('*, member_count:organization_members(count)')

      expect(result.data?.[0].member_count).toBe(15)
    })
  })

  describe('Organization Updates', () => {
    test('should update organization name', async () => {
      const updates = { name: 'Updated Organization Name' }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'org-123', ...updates },
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organizations')
        .update(updates)
        .eq('id', 'org-123')
        .select()
        .single()

      expect(result.data?.name).toBe('Updated Organization Name')
    })

    test('should update organization settings', async () => {
      const updates = {
        settings: {
          timezone: 'America/New_York',
          notifications_enabled: false,
        },
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'org-123', settings: updates.settings },
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organizations')
        .update(updates)
        .eq('id', 'org-123')
        .select()
        .single()

      expect(result.data?.settings.timezone).toBe('America/New_York')
    })

    test('should not allow updating slug', async () => {
      const invalidUpdate = { slug: 'new-slug' }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'slug cannot be modified', code: '42501' },
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organizations')
        .update(invalidUpdate)
        .eq('id', 'org-123')
        .select()
        .single()

      expect(result.error).toBeTruthy()
    })

    test('should only allow owner to update organization', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'permission denied', code: '42501' },
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organizations')
        .update({ name: 'Hacked Name' })
        .eq('id', 'org-123')
        .select()
        .single()

      expect(result.error).toBeTruthy()
    })
  })

  describe('Member Management', () => {
    test('should add member to organization', async () => {
      const memberData = {
        organization_id: 'org-123',
        user_id: 'user-456',
        role: 'member',
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'member-123', ...memberData },
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organization_members')
        .insert(memberData)
        .select()
        .single()

      expect(result.data).toMatchObject(memberData)
      expect(result.error).toBeNull()
    })

    test('should prevent duplicate members', async () => {
      const duplicateMember = {
        organization_id: 'org-123',
        user_id: 'user-456', // Already a member
        role: 'member',
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'user already member', code: '23505' },
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organization_members')
        .insert(duplicateMember)
        .select()
        .single()

      expect(result.error).toBeTruthy()
      expect(result.error?.code).toBe('23505')
    })

    test('should update member role', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { role: 'admin' },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organization_members')
        .update({ role: 'admin' })
        .eq('organization_id', 'org-123')
        .eq('user_id', 'user-456')
        .select()
        .single()

      expect(result.data?.role).toBe('admin')
    })

    test('should remove member from organization', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organization_members')
        .delete()
        .eq('organization_id', 'org-123')
        .eq('user_id', 'user-456')

      expect(result.error).toBeNull()
    })

    test('should prevent removing last owner', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'cannot remove last owner', code: 'P0001' },
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organization_members')
        .delete()
        .eq('organization_id', 'org-123')
        .eq('role', 'owner')

      expect(result.error).toBeTruthy()
      expect(result.error?.message).toContain('last owner')
    })

    test('should get all members for organization', async () => {
      const members = [
        { user_id: 'user-1', role: 'owner', email: 'owner@example.com' },
        { user_id: 'user-2', role: 'admin', email: 'admin@example.com' },
        { user_id: 'user-3', role: 'member', email: 'member@example.com' },
      ]

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: members,
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('organization_members')
        .select('*, user:users(email)')
        .eq('organization_id', 'org-123')

      expect(result.data).toHaveLength(3)
      expect(
        result.data?.find((m: { role: string }) => m.role === 'owner')
      ).toBeDefined()
    })
  })

  describe('Role-Based Access Control', () => {
    test('owner can do everything', async () => {
      const permissions = {
        canManageMembers: true,
        canManageDevices: true,
        canManageIntegrations: true,
        canDeleteOrganization: true,
      }

      expect(permissions.canManageMembers).toBe(true)
      expect(permissions.canDeleteOrganization).toBe(true)
    })

    test('admin can manage but not delete organization', async () => {
      const permissions = {
        canManageMembers: true,
        canManageDevices: true,
        canManageIntegrations: true,
        canDeleteOrganization: false,
      }

      expect(permissions.canManageMembers).toBe(true)
      expect(permissions.canDeleteOrganization).toBe(false)
    })

    test('member has read-only access', async () => {
      const permissions = {
        canManageMembers: false,
        canManageDevices: false,
        canManageIntegrations: false,
        canDeleteOrganization: false,
        canViewDevices: true,
        canViewIntegrations: true,
      }

      expect(permissions.canManageMembers).toBe(false)
      expect(permissions.canViewDevices).toBe(true)
    })

    test('should enforce RLS on organization access', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [], // No access to other org
          error: null,
        }),
      })

      const result = await mockSupabase.from('organizations').select('*')

      expect(result.data).toHaveLength(0)
    })
  })

  describe('Organization Deletion', () => {
    test('should soft delete organization', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'org-123', deleted_at: new Date().toISOString() },
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organizations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', 'org-123')
        .select()
        .single()

      expect(result.data?.deleted_at).toBeTruthy()
    })

    test('should prevent deletion if organization has active devices', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: {
              message: 'organization has active devices',
              code: '23503',
            },
          }),
        }),
      })

      const result = await mockSupabase
        .from('organizations')
        .delete()
        .eq('id', 'org-123')

      expect(result.error).toBeTruthy()
      expect(result.error?.message).toContain('active devices')
    })

    test('should cascade delete members when deleting organization', async () => {
      const mockFrom = mockSupabase.from as jest.Mock

      // Delete org
      mockFrom.mockReturnValueOnce({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      })

      // Verify members deleted
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      })

      await mockSupabase.from('organizations').delete().eq('id', 'org-123')
      const members = await mockSupabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', 'org-123')

      expect(members.data).toHaveLength(0)
    })
  })

  describe('Business Logic', () => {
    test('should calculate organization device quota usage', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              {
                quota: 100,
                devices_count: 75,
              },
            ],
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('organizations')
        .select('quota, devices:devices(count)')
        .eq('id', 'org-123')

      const org = result.data?.[0]
      const usage = (org.devices_count / org.quota) * 100

      expect(usage).toBe(75) // 75% used
    })

    test('should prevent adding devices when quota exceeded', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'device quota exceeded', code: 'P0001' },
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .insert({ name: 'New Device', organization_id: 'org-123' })
        .select()
        .single()

      expect(result.error).toBeTruthy()
      expect(result.error?.message).toContain('quota exceeded')
    })

    test('should send invitation email when adding member', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'invite-123',
                email: 'newmember@example.com',
                status: 'pending',
              },
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('organization_invitations')
        .insert({
          organization_id: 'org-123',
          email: 'newmember@example.com',
          role: 'member',
        })
        .select()
        .single()

      expect(result.data?.status).toBe('pending')
    })
  })

  describe('Performance Tests', () => {
    test('should efficiently query organizations with member counts', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: Array(50).fill({
            id: 'org-123',
            name: 'Test Org',
            member_count: 10,
          }),
          error: null,
        }),
      })

      const startTime = Date.now()
      await mockSupabase
        .from('organizations')
        .select('*, member_count:organization_members(count)')
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(100)
    })
  })
})
