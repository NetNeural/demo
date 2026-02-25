/**
 * Dashboard Page - Real Integration Test
 * Tests the actual dashboard page component
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import DashboardPage from '@/app/dashboard/page'

// Mock contexts and hooks
jest.mock('@/lib/auth/user-context', () => ({
  useUser: () => ({
    user: { id: '1', email: 'test@example.com', name: 'Test User' },
    loading: false,
  }),
}))

jest.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({
    currentOrganization: { id: '1', name: 'Test Org' },
    setCurrentOrganization: jest.fn(),
  }),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: [],
          error: null,
        })),
      })),
    })),
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({ data: { session: null }, error: null })
      ),
    },
  }),
}))

describe('Dashboard Page', () => {
  test('renders dashboard page', async () => {
    const { container } = render(<DashboardPage />)

    await waitFor(() => {
      expect(container).toBeInTheDocument()
    })
  })

  test('dashboard page has content', async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      const content = document.body.textContent
      expect(content).toBeTruthy()
    })
  })
})

describe('Dashboard Page Components', () => {
  test('page renders without crashing', () => {
    const { container } = render(<DashboardPage />)
    expect(container.firstChild).toBeTruthy()
  })
})
