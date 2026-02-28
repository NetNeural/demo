/**
 * Comprehensive Tests for Device Components
 *
 * Smoke tests verifying components can be imported and their modules are defined.
 * Components use context providers (useOrganization, etc.) so full render tests
 * require proper provider wrappers.
 */

// Mock dependencies before imports
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: null }, error: null }),
      getSession: jest
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      unsubscribe: jest.fn(),
    })),
    removeChannel: jest.fn().mockResolvedValue(null),
  })),
}))

jest.mock('@/hooks/queries/useDevices', () => ({
  useDevicesQuery: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
  useCreateDeviceMutation: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
  })),
}))

jest.mock('@/hooks/queries/useOrganizations', () => ({
  useOrganizationsQuery: jest.fn(() => ({
    data: [],
    isLoading: false,
  })),
}))

jest.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: jest.fn(() => ({
    currentOrganization: {
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      settings: null,
    },
    userOrganizations: [{ id: 'org-1', name: 'Test Org', slug: 'test-org' }],
    canManageDevices: true,
    isLoading: false,
    switchOrganization: jest.fn(),
    refreshOrganizations: jest.fn(),
  })),
  OrganizationProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: jest.fn(() => ({
    preferences: {
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
      language: 'en',
    },
    updatePreferences: jest.fn(),
    isLoading: false,
  })),
}))

jest.mock('@/lib/edge-functions/client', () => ({
  edgeFunctions: {
    devices: {
      list: jest.fn().mockResolvedValue({
        success: true,
        data: { devices: [] },
        error: null,
      }),
      create: jest
        .fn()
        .mockResolvedValue({ success: true, data: null, error: null }),
    },
    integrations: {
      list: jest.fn().mockResolvedValue({
        success: true,
        data: { integrations: [] },
        error: null,
      }),
    },
  },
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/dashboard/devices',
  useSearchParams: () => new URLSearchParams(),
}))

import React from 'react'
import { render, screen } from '../utils/test-utils'

describe('DevicesHeader', () => {
  test('module can be imported', async () => {
    const mod = await import('@/components/devices/DevicesHeader')
    expect(mod.DevicesHeader).toBeDefined()
  })

  test('renders header with devices text', () => {
    const { DevicesHeader } = require('@/components/devices/DevicesHeader')
    render(<DevicesHeader />)
    expect(screen.getAllByText(/devices/i).length).toBeGreaterThan(0)
  })
})

describe('DevicesList', () => {
  test('module can be imported', async () => {
    const mod = await import('@/components/devices/DevicesList')
    expect(mod.DevicesList).toBeDefined()
  })
})

describe('TransferDeviceDialog', () => {
  test('module can be imported', async () => {
    const mod = await import('@/components/devices/TransferDeviceDialog')
    expect(mod.TransferDeviceDialog).toBeDefined()
  })
})

describe('DeviceIntegrationManager', () => {
  test('module can be imported', async () => {
    const mod = await import('@/components/devices/DeviceIntegrationManager')
    expect(mod.DeviceIntegrationManager).toBeDefined()
  })

  test('renders integration manager', () => {
    const {
      DeviceIntegrationManager,
    } = require('@/components/devices/DeviceIntegrationManager')
    render(<DeviceIntegrationManager />)
    expect(screen.getAllByText(/integration/i).length).toBeGreaterThan(0)
  })
})
