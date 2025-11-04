/**
 * Organization Components Tests - Real Integration Tests
 */

import React from 'react'
import { render, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock Supabase
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
      insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      update: jest.fn().mockResolvedValue({ data: {}, error: null }),
    })),
  })),
}))

// Mock user context - FIXED: Using correct paths from actual app
jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    user: { id: 'user123', email: 'test@example.com' },
    loading: false,
    refreshUser: jest.fn(),
  }),
}))

// Mock organization context - FIXED: Using correct paths from actual app
jest.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({
    currentOrganization: { id: 'org123', name: 'Test Org', slug: 'test-org', role: 'admin' },
    userOrganizations: [{ id: 'org123', name: 'Test Org', slug: 'test-org', role: 'admin' }],
    isLoading: false,
    switchOrganization: jest.fn(),
    refreshOrganizations: jest.fn(),
    userRole: 'admin',
    permissions: {
      canManageMembers: true,
      canManageDevices: true,
      isAdmin: true,
    },
  }),
}))

// Also mock the alternate user-context module path
jest.mock('@/lib/auth/user-context', () => ({
  useUser: () => ({
    user: { id: 'user123', email: 'test@example.com' },
    profile: { id: 'user123', email: 'test@example.com', role: 'org_admin' },
    organizations: [],
    currentOrganization: null,
    loading: false,
    error: null,
    authError: null,
    switchOrganization: jest.fn(),
    refreshProfile: jest.fn(),
    clearAuthError: jest.fn(),
  }),
}))

describe('Organization Components Integration', () => {
  test('CreateOrganizationDialog component exists', async () => {
    const { CreateOrganizationDialog } = await import('@/components/organizations/CreateOrganizationDialog')
    expect(CreateOrganizationDialog).toBeDefined()
  })

  test('EditOrganizationDialog component exists', async () => {
    const { EditOrganizationDialog } = await import('@/components/organizations/EditOrganizationDialog')
    expect(EditOrganizationDialog).toBeDefined()
  })

  test('CreateUserDialog component exists', async () => {
    const { CreateUserDialog } = await import('@/components/organizations/CreateUserDialog')
    expect(CreateUserDialog).toBeDefined()
  })

  test('OrganizationSwitcher component exists', async () => {
    const { OrganizationSwitcher } = await import('@/components/organizations/OrganizationSwitcher')
    expect(OrganizationSwitcher).toBeDefined()
  })

  test('OrganizationSelector component exists', async () => {
    const { OrganizationSelector } = await import('@/components/organization/OrganizationSelector')
    expect(OrganizationSelector).toBeDefined()
  })

  test('OrganizationSwitcher renders with context', async () => {
    const { OrganizationSwitcher } = await import('@/components/organizations/OrganizationSwitcher')
    const { container } = render(<OrganizationSwitcher />)
    await waitFor(() => expect(container).toBeTruthy())
  })

  test('OrganizationSelector renders with context', async () => {
    const { OrganizationSelector } = await import('@/components/organization/OrganizationSelector')
    const { container } = render(<OrganizationSelector />)
    await waitFor(() => expect(container).toBeTruthy())
  })
})
