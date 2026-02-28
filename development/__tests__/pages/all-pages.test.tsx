/**
 * Comprehensive Page Components Tests
 * Tests all major page.tsx files to increase coverage
 */

import React from 'react'
import { render, waitFor } from '@testing-library/react'

// Mock all necessary contexts and hooks
const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' }
const mockOrg = { id: '1', name: 'Test Org' }

jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: mockUser, loading: false }),
  UserProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

jest.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({
    currentOrganization: mockOrg,
    setCurrentOrganization: jest.fn(),
    organizations: [mockOrg],
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

// The global jest.setup.js already mocks @/lib/supabase/client with proper chaining

describe('Dashboard Pages', () => {
  test('Dashboard main page renders', async () => {
    const DashboardPage = (await import('@/app/dashboard/page')).default
    const { container } = render(<DashboardPage />)
    await waitFor(() => expect(container.firstChild).toBeTruthy())
  })

  test('Devices page renders', async () => {
    const DevicesPage = (await import('@/app/dashboard/devices/page')).default
    const { container } = render(<DevicesPage />)
    await waitFor(() => expect(container.firstChild).toBeTruthy())
  })

  test('Alerts page renders', async () => {
    const AlertsPage = (await import('@/app/dashboard/alerts/page')).default
    const { container } = render(<AlertsPage />)
    await waitFor(() => expect(container.firstChild).toBeTruthy())
  })

  test('Analytics page renders', async () => {
    const AnalyticsPage = (await import('@/app/dashboard/analytics/page'))
      .default
    const { container } = render(<AnalyticsPage />)
    await waitFor(() => expect(container.firstChild).toBeTruthy())
  })

  test('Organizations page renders', async () => {
    const OrganizationsPage = (
      await import('@/app/dashboard/organizations/page')
    ).default
    const { container } = render(<OrganizationsPage />)
    await waitFor(() => expect(container.firstChild).toBeTruthy())
  })

  test('Settings page renders', async () => {
    const SettingsPage = (await import('@/app/dashboard/settings/page')).default
    const { container } = render(<SettingsPage />)
    await waitFor(() => expect(container.firstChild).toBeTruthy())
  })

  test('Integrations page renders', async () => {
    const IntegrationsPage = (await import('@/app/dashboard/integrations/page'))
      .default
    const { container } = render(<IntegrationsPage />)
    await waitFor(() => expect(container.firstChild).toBeTruthy())
  })
})

describe('Auth Pages', () => {
  test('Login page renders', async () => {
    const LoginPage = (await import('@/app/auth/login/page')).default
    const { container } = render(<LoginPage />)
    await waitFor(() => expect(container.firstChild).toBeTruthy())
  })
})

describe('Root Pages', () => {
  test('Root page has export', async () => {
    const RootModule = await import('@/app/page')
    expect(RootModule.default).toBeDefined()
  })
})
