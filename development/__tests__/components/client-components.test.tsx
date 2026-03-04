/**
 * Dashboard Components - Client Components Tests
 * Tests for components that use hooks and fetch their own data
 */

import React from 'react'
import { render, waitFor } from '@testing-library/react'

// Mock contexts
const mockUser = { id: '1', email: 'test@example.com', name: 'Test User', isSuperAdmin: false }
const mockOrg = { id: '1', name: 'Test Org' }

jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: mockUser, loading: false, refreshUser: jest.fn() }),
}))

jest.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({
    currentOrganization: mockOrg,
    userOrganizations: [mockOrg],
    setCurrentOrganization: jest.fn(),
    isLoading: false,
    refreshOrganizations: jest.fn(),
    isOwner: false,
    isAdmin: true,
    isReseller: false,
    canSeeResellerAlerts: true,
    canApproveReseller: false,
    permissions: {
      canManageMembers: true,
      canManageDevices: true,
      canManageIntegrations: true,
      isOwner: false,
      isAdmin: true,
      isMember: true,
      isViewer: false,
      canManageSettings: true,
    },
    userRole: 'admin',
    stats: {
      totalDevices: 0,
      onlineDevices: 0,
      totalUsers: 0,
      activeAlerts: 0,
      totalLocations: 0,
      activeIntegrations: 0,
    },
  }),
}))

// Also mock the alternate user-context module path used by some components
jest.mock('@/lib/auth/user-context', () => ({
  useUser: () => ({
    user: mockUser,
    profile: { id: mockUser.id, email: mockUser.email, role: 'org_admin' },
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

// Mock edge-functions client (used by AlertsCard, SystemStatsCard, LocationsCard)
jest.mock('@/lib/edge-functions/client', () => ({
  edgeFunctions: {
    alerts: {
      list: jest.fn(() => Promise.resolve({ success: true, data: { alerts: [] } })),
    },
    organizations: {
      stats: jest.fn(() =>
        Promise.resolve({
          success: true,
          data: {
            totalDevices: 0, onlineDevices: 0, offlineDevices: 0,
            activeAlerts: 0, totalOrganizations: 0, totalUsers: 0, dataPoints: 0,
          },
        })
      ),
    },
    locations: {
      list: jest.fn(() => Promise.resolve({ success: true, data: [] })),
    },
    accessRequests: {
      list: jest.fn(() => Promise.resolve({ success: true, data: { requests: [] } })),
    },
  },
}))
// Mock @/lib/edge-functions (used by DashboardOverview — different import path)
jest.mock('@/lib/edge-functions', () => ({
  edgeFunctions: {
    alerts: {
      list: jest.fn(() => Promise.resolve({ success: true, data: { alerts: [] } })),
    },
    organizations: {
      stats: jest.fn(() =>
        Promise.resolve({
          success: true,
          data: {
            totalDevices: 0, onlineDevices: 0, offlineDevices: 0,
            activeAlerts: 0, totalOrganizations: 0, totalUsers: 0,
          },
        })
      ),
    },
  },
}))
// Mock @/lib/auth fetchEdgeFunction (used by DeviceStatusCard)
jest.mock('@/lib/auth', () => ({
  fetchEdgeFunction: jest.fn(() => Promise.resolve({ devices: [] })),
}))

// Mock supabase client — fully chainable + thenable for any query chain
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const makeChain = (): any => {
      const chain: any = {}
      ;[
        'select', 'eq', 'neq', 'not', 'gt', 'gte', 'lt', 'lte',
        'in', 'is', 'like', 'ilike', 'or', 'and', 'filter',
        'order', 'limit', 'range', 'match',
        'insert', 'update', 'upsert', 'delete',
      ].forEach((m) => { chain[m] = () => chain })
      chain.single = () => Promise.resolve({ data: { full_name: 'NetNeural Admin' }, error: null })
      chain.then = (resolve: any, reject?: any) =>
        Promise.resolve({ data: [], error: null }).then(resolve, reject)
      chain.catch = (reject: any) => Promise.resolve({ data: [], error: null }).catch(reject)
      return chain
    }
    return {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'user1', email: 'admin@netneural.ai', user_metadata: {} } },
        }),
        getSession: async () => ({
          data: { session: { access_token: 'tok12345', expires_at: Date.now() } },
        }),
        updateUser: async () => ({ data: null, error: null }),
        signInWithPassword: async () => ({ error: null }),
      },
      from: (_table: string) => makeChain(),
    }
  },
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboard',
}))

describe('Dashboard Components', () => {
  test('DashboardShell renders', async () => {
    const DashboardShell = (
      await import('@/components/dashboard/DashboardShell')
    ).default
    const { container } = render(
      <DashboardShell>
        <div>Content</div>
      </DashboardShell>
    )
    expect(container).toBeTruthy()
  })

  test('AlertsCard renders', async () => {
    const { AlertsCard } = await import('@/components/dashboard/AlertsCard')
    const { container } = render(<AlertsCard />)
    await waitFor(() => expect(container).toBeTruthy())
  })

  test('DeviceStatusCard renders', async () => {
    const { DeviceStatusCard } =
      await import('@/components/dashboard/DeviceStatusCard')
    const { container } = render(<DeviceStatusCard />)
    await waitFor(() => expect(container).toBeTruthy())
  })

  test('LocationsCard renders', async () => {
    const { LocationsCard } =
      await import('@/components/dashboard/LocationsCard')
    const { container } = render(<LocationsCard />)
    await waitFor(() => expect(container).toBeTruthy())
  })

  test('RecentActivityCard renders', async () => {
    const { RecentActivityCard } =
      await import('@/components/dashboard/RecentActivityCard')
    const { container } = render(<RecentActivityCard />)
    await waitFor(() => expect(container).toBeTruthy())
  })

  test('SystemStatsCard renders', async () => {
    const { SystemStatsCard } =
      await import('@/components/dashboard/SystemStatsCard')
    const { container } = render(<SystemStatsCard />)
    await waitFor(() => expect(container).toBeTruthy())
  })

  test('DashboardOverview renders', async () => {
    const { DashboardOverview } =
      await import('@/components/dashboard/DashboardOverview')
    const { container } = render(<DashboardOverview />)
    await waitFor(() => expect(container).toBeTruthy())
  })
})

describe('Settings Components', () => {
  test('ProfileTab renders', async () => {
    const { ProfileTab } =
      await import('@/app/dashboard/settings/components/ProfileTab')
    const { container } = render(<ProfileTab />)
    await waitFor(() => expect(container).toBeTruthy())
  })

  test('SecurityTab renders', async () => {
    const { SecurityTab } =
      await import('@/app/dashboard/settings/components/SecurityTab')
    const { container } = render(<SecurityTab />)
    await waitFor(() => expect(container).toBeTruthy())
  })

  test('PreferencesTab renders', async () => {
    const { PreferencesTab } =
      await import('@/app/dashboard/settings/components/PreferencesTab')
    const { container } = render(<PreferencesTab />)
    await waitFor(() => expect(container).toBeTruthy())
  })
})

describe('Organization Components', () => {
  test('OverviewTab renders with organizationId', async () => {
    const { OverviewTab } =
      await import('@/app/dashboard/organizations/components/OverviewTab')
    const { container } = render(<OverviewTab organizationId="1" />)
    await waitFor(() => expect(container).toBeTruthy())
  })

  test('MembersTab renders with organizationId', async () => {
    const { MembersTab } =
      await import('@/app/dashboard/organizations/components/MembersTab')
    const { container } = render(<MembersTab organizationId="1" />)
    await waitFor(() => expect(container).toBeTruthy())
  })

  test('LocationsTab renders with organizationId', async () => {
    const { LocationsTab } =
      await import('@/app/dashboard/organizations/components/LocationsTab')
    const { container } = render(<LocationsTab organizationId="1" />)
    await waitFor(() => expect(container).toBeTruthy())
  })
})
