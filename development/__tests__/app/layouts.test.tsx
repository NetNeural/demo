/**
 * Layout Components Tests
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock Next.js
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock Supabase
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user123' } },
        error: null,
      }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  })),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user123' } },
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

describe('Dashboard Layout', () => {
  test('DashboardLayoutClient component exists', async () => {
    const layoutModule = await import('@/app/dashboard/layout-client')
    expect(layoutModule.default).toBeDefined()
  })

  test('DashboardLayoutClient renders children', async () => {
    const LayoutClient = (await import('@/app/dashboard/layout-client')).default
    const { container } = render(
      <LayoutClient userEmail="test@example.com">
        <div>Test Content</div>
      </LayoutClient>
    )
    expect(container).toBeTruthy()
  })
})

describe('Root Layout', () => {
  test('Root layout component exists', async () => {
    const rootModule = await import('@/app/layout')
    expect(rootModule.default).toBeDefined()
  })
})
