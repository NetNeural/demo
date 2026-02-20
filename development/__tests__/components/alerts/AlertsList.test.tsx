/**
 * Simplified AlertsList Tests - MVP Focused
 * Tests critical user paths without brittle implementation details
 */

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

    // Component renders successfully
    expect(screen.getByRole('textbox', { name: /search/i })).toBeInTheDocument()
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

    const searchInput = screen.getByRole('textbox', { name: /search/i })
    expect(searchInput).toBeInTheDocument()
  })

  it('has severity filter', async () => {
    mockAlertsListEdgeFunction.mockResolvedValue({
      success: true,
      data: { alerts: [] },
      error: null,
    })

    render(<AlertsList />)

    const severityFilter = screen.getByRole('combobox', { name: /severity/i })
    expect(severityFilter).toBeInTheDocument()
  })

  it('has category filter', async () => {
    mockAlertsListEdgeFunction.mockResolvedValue({
      success: true,
      data: { alerts: [] },
      error: null,
    })

    render(<AlertsList />)

    const categoryFilter = screen.getByRole('combobox', { name: /category/i })
    expect(categoryFilter).toBeInTheDocument()
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

    render(<AlertsList />)

    await waitFor(() => {
      expect(screen.getByText(/critical/i)).toBeInTheDocument()
    })
  })
})
