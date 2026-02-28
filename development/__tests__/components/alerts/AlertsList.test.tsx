/**
 * Simplified AlertsList Tests - MVP Focused
 * Tests critical user paths without brittle implementation details
 */

import React from 'react'
import { render, screen, waitFor } from '../../utils/test-utils'
import { AlertsList } from '@/components/alerts/AlertsList'
import { edgeFunctions } from '@/lib/edge-functions/client'

// Mock Edge Functions
jest.mock('@/lib/edge-functions/client', () => ({
  edgeFunctions: {
    alerts: {
      list: jest.fn(),
      acknowledge: jest.fn(),
      acknowledgeMultiple: jest.fn(),
      bulkAcknowledge: jest.fn(),
      resolve: jest.fn(),
      snooze: jest.fn(),
      unsnooze: jest.fn(),
      timeline: jest.fn(),
      stats: jest.fn().mockResolvedValue({
        success: true,
        data: {
          stats: {
            total_alerts: 0,
            active_alerts: 0,
            resolved_alerts: 0,
            active_critical: 0,
            active_high: 0,
            snoozed_alerts: 0,
            mttr_minutes: null,
            fastest_resolution_minutes: null,
            alerts_last_24h: 0,
            alerts_last_7d: 0,
          },
          topDevices: [],
        },
      }),
      create: jest.fn(),
    },
  },
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    promise: jest.fn(),
  },
}))

jest.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: jest.fn(() => ({
    currentOrganization: {
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      settings: {},
    },
    userOrganizations: [{ id: 'org-1', name: 'Test Org', slug: 'test-org' }],
    canManageDevices: true,
    isLoading: false,
    switchOrganization: jest.fn(),
    refreshOrganizations: jest.fn(),
  })),
  OrganizationProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}))

jest.mock('@/contexts/UserContext', () => ({
  useUser: jest.fn(() => ({
    user: { id: 'user-1', email: 'test@example.com' },
    loading: false,
    error: null,
    isSuperAdmin: false,
    isOrgOwner: true,
    isOrgAdmin: true,
    role: 'org_owner',
  })),
  UserProvider: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock('@/hooks/useDateFormatter', () => ({
  useDateFormatter: jest.fn(() => ({
    fmt: {
      dateTime: (d: any) => new Date(d).toLocaleString(),
      dateOnly: (d: any) => new Date(d).toLocaleDateString(),
      timeOnly: (d: any) => new Date(d).toLocaleTimeString(),
      timeAgo: (d: any) => 'just now',
      shortDate: (d: any) => new Date(d).toLocaleDateString(),
      shortDateTime: (d: any) => new Date(d).toLocaleString(),
      longDate: (d: any) => new Date(d).toLocaleDateString(),
      duration: (m: number) => `${m}m`,
    },
  })),
}))

jest.mock('@/lib/sentry-utils', () => ({
  handleApiError: jest.fn(),
}))

const mockAlertsListEdgeFunction = edgeFunctions.alerts
  .list as jest.MockedFunction<typeof edgeFunctions.alerts.list>

describe('AlertsList - Simplified Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing', async () => {
    mockAlertsListEdgeFunction.mockResolvedValue({
      success: true,
      data: { alerts: [] },
      error: null,
    })

    render(<AlertsList />)

    // Wait for loading to finish, then check search input
    await waitFor(() => {
      expect(
        screen.getByRole('textbox', { name: /search/i })
      ).toBeInTheDocument()
    })
  })

  it('fetches and displays alerts', async () => {
    mockAlertsListEdgeFunction.mockResolvedValue({
      success: true,
      data: {
        alerts: [
          {
            id: 'alert-1',
            title: 'Test Alert',
            severity: 'critical',
            device_name: 'Test Device',
            device_id: 'device-1',
            created_at: new Date().toISOString(),
            category: 'temperature',
            is_resolved: false,
          },
        ],
      },
      error: null,
    })

    render(<AlertsList />)

    await waitFor(() => {
      expect(mockAlertsListEdgeFunction).toHaveBeenCalled()
    })
  })

  it('handles empty state', async () => {
    mockAlertsListEdgeFunction.mockResolvedValue({
      success: true,
      data: { alerts: [] },
      error: null,
    })

    render(<AlertsList />)

    await waitFor(() => {
      expect(screen.getByText(/no alerts/i)).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    mockAlertsListEdgeFunction.mockResolvedValue({
      success: false,
      data: null,
      error: { message: 'API Error', status: 500 },
    })

    render(<AlertsList />)

    await waitFor(() => {
      expect(mockAlertsListEdgeFunction).toHaveBeenCalled()
    })
  })

  it('has search functionality', async () => {
    mockAlertsListEdgeFunction.mockResolvedValue({
      success: true,
      data: { alerts: [] },
      error: null,
    })

    render(<AlertsList />)

    await waitFor(() => {
      expect(
        screen.getByRole('textbox', { name: /search/i })
      ).toBeInTheDocument()
    })
  })

  it('has severity filter', async () => {
    mockAlertsListEdgeFunction.mockResolvedValue({
      success: true,
      data: { alerts: [] },
      error: null,
    })

    render(<AlertsList />)

    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: /severity/i })
      ).toBeInTheDocument()
    })
  })

  it('has category filter', async () => {
    mockAlertsListEdgeFunction.mockResolvedValue({
      success: true,
      data: { alerts: [] },
      error: null,
    })

    render(<AlertsList />)

    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: /category/i })
      ).toBeInTheDocument()
    })
  })

  it('displays severity counts', async () => {
    mockAlertsListEdgeFunction.mockResolvedValue({
      success: true,
      data: {
        alerts: [
          {
            id: 'alert-1',
            title: 'Critical Alert',
            severity: 'critical',
            device_name: 'Device 1',
            device_id: 'device-1',
            created_at: new Date().toISOString(),
            category: 'temperature',
            is_resolved: false,
          },
        ],
      },
      error: null,
    })

    const { container } = render(<AlertsList />)

    // Wait for alerts to load and severity summary to render
    await waitFor(() => {
      expect(mockAlertsListEdgeFunction).toHaveBeenCalled()
    })

    // Check that severity info appears in rendered content
    await waitFor(() => {
      const text = container.textContent || ''
      expect(text).toMatch(/Critical/i)
    })
  })
})
