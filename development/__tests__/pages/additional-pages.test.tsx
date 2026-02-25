/**
 * Additional Page Tests
 */

import React from 'react'
import '@testing-library/jest-dom'

// Mock Next.js
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock Supabase server
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      }),
    },
  })),
}))

// Mock contexts - FIXED: Using correct paths from actual app
jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    user: { id: 'user123', email: 'test@example.com' },
    loading: false,
    refreshUser: jest.fn(),
  }),
  UserProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

jest.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({
    currentOrganization: { id: 'org123', name: 'Test Org', slug: 'test-org' },
    userOrganizations: [{ id: 'org123', name: 'Test Org', slug: 'test-org' }],
    isLoading: false,
    switchOrganization: jest.fn(),
    refreshOrganizations: jest.fn(),
  }),
  OrganizationProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

describe('Additional Pages', () => {
  test('Test Sentry page module loads', async () => {
    // Test Sentry page is a client component, so just verify it can be imported
    const TestSentryPage = (await import('@/app/test-sentry/page')).default
    expect(TestSentryPage).toBeDefined()
  })

  test('Dashboard Users page renders', async () => {
    const UsersPage = (await import('@/app/dashboard/users/page')).default
    const PageComponent = await UsersPage()
    expect(PageComponent).toBeTruthy()
  })
})
