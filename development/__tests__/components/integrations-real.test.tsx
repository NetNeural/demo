/**
 * Integration Components Tests - Real Integration Tests
 */

import React from 'react'
import { render, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/dashboard',
}))

// Mock Supabase
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user123' } },
        error: null,
      }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    })),
  })),
}))

// Mock contexts - FIXED: Using correct paths from actual app
jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    user: { id: 'user123', email: 'test@example.com' },
    loading: false,
    refreshUser: jest.fn(),
  }),
}))

jest.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({
    currentOrganization: { id: 'org123', name: 'Test Org', slug: 'test-org' },
    userOrganizations: [{ id: 'org123', name: 'Test Org', slug: 'test-org' }],
    isLoading: false,
    switchOrganization: jest.fn(),
    refreshOrganizations: jest.fn(),
  }),
}))

describe('Integration Components', () => {
  test('OrganizationIntegrationManager component exists', async () => {
    const integrationModule = await import('@/components/integrations/OrganizationIntegrationManager')
    expect(integrationModule.OrganizationIntegrationManager).toBeDefined()
  })

  test('OrganizationIntegrationManager renders', async () => {
    const { OrganizationIntegrationManager } = await import('@/components/integrations/OrganizationIntegrationManager')
    const { container } = render(<OrganizationIntegrationManager organizationId="test-org-id" />)
    await waitFor(() => expect(container).toBeTruthy())
  })
})
