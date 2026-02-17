/**
 * Unit Tests for AlertsList Component
 * 
 * Tests coverage:
 * - Rendering and initial load
 * - Loading states
 * - Tab filtering (all, unacknowledged, connectivity, security, environmental, system)
 * - View mode toggle (cards/table)
 * - Search functionality
 * - Severity filtering
 * - Category filtering
 * - Alert acknowledgment
 * - Bulk operations
 * - Alert details modal
 * - Grouped alerts
 * - Empty states
 * - Error handling
 * - Edge Function calls
 */

import { render, screen, waitFor, within } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { AlertsList } from '@/components/alerts/AlertsList'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { toast } from 'sonner'
import { createMockAlert, createMockDevice, resetMockCounter } from '../../mocks/factories'

// Mock dependencies
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

describe('AlertsList Component', () => {
  const mockAlerts = [
    {
      id: 'alert-1',
      title: 'Temperature Threshold Exceeded',
      description: 'Device sensor temperature above critical maximum',
      severity: 'critical' as const,
      device: 'Sensor A',
      deviceId: 'device-1',
      timestamp: '2 minutes ago',
      rawTimestamp: new Date(Date.now() - 2 * 60 * 1000),
      acknowledged: false,
      category: 'temperature' as const,
      metadata: {
        sensor_type: 'temperature',
        current_value: 85,
        breach_type: 'critical_max' as const,
        critical_max: 80,
      },
    },
    {
      id: 'alert-2',
      title: 'Device Offline',
      description: 'Device has not reported data in 30 minutes',
      severity: 'high' as const,
      device: 'Sensor B',
      deviceId: 'device-2',
      timestamp: '5 minutes ago',
      rawTimestamp:new Date(Date.now() - 5 * 60 * 1000),
      acknowledged: false,
      category: 'connectivity' as const,
    },
    {
      id: 'alert-3',
      title: 'Low Battery',
      description: 'Device battery below 20%',
      severity: 'medium' as const,
      device: 'Sensor C',
      deviceId: 'device-3',
      timestamp: '10 minutes ago',
      rawTimestamp: new Date(Date.now() - 10 * 60 * 1000),
      acknowledged: true,
      acknowledgedBy: 'user@example.com',
      acknowledgedAt: new Date(Date.now() - 5 * 60 * 1000),
      category: 'battery' as const,
    },
    {
      id: 'alert-4',
      title: 'Security Alert',
      description: 'Unauthorized access attempt detected',
      severity: 'critical' as const,
      device: 'Gateway 1',
      deviceId: 'device-4',
      timestamp: '1 hour ago',
      rawTimestamp: new Date(Date.now() - 60 * 60 * 1000),
      acknowledged: false,
      category: 'security' as const,
    },
  ]

  beforeEach(() => {
    resetMockCounter()
    jest.clearAllMocks()
    
    // Default mock response
    ;(edgeFunctions.alerts.list as jest.Mock).mockResolvedValue({
      success: true,
      data: { alerts: mockAlerts },
    })
  })

  describe('Rendering and Initial Load', () => {
    it('renders alerts list container', async () => {
      render(<AlertsList />)
      
      expect(screen.getByText(/alerts/i)).toBeInTheDocument()
    })

    it('shows loading spinner while fetching alerts', () => {
      render(<AlertsList />)
      
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('fetches alerts on mount', async () => {
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(edgeFunctions.alerts.list).toHaveBeenCalledWith(
          expect.any(String),
          { resolved: false }
        )
      })
    })

    it('displays alerts after loading', async () => {
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
        expect(screen.getByText('Device Offline')).toBeInTheDocument()
        expect(screen.getByText('Low Battery')).toBeInTheDocument()
      })
    })

    it('displays alert count', async () => {
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText(/4 alerts/i)).toBeInTheDocument()
      })
    })
  })

  describe('Tab Filtering', () => {
    it('shows all alerts in "All" tab', async () => {
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
        expect(screen.getByText('Device Offline')).toBeInTheDocument()
      })
    })

    it('filters to unacknowledged alerts', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      await user.click(screen.getByRole('tab', { name: /unacknowledged/i }))
      
      expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      expect(screen.queryByText('Low Battery')).not.toBeInTheDocument() // Acknowledged
    })

    it('filters to connectivity alerts', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Device Offline')).toBeInTheDocument()
      })
      
      await user.click(screen.getByRole('tab', { name: /connectivity/i }))
      
      expect(screen.getByText('Device Offline')).toBeInTheDocument()
      expect(screen.queryByText('Temperature Threshold Exceeded')).not.toBeInTheDocument()
    })

    it('filters to security alerts', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Security Alert')).toBeInTheDocument()
      })
      
      await user.click(screen.getByRole('tab', { name: /security/i }))
      
      expect(screen.getByText('Security Alert')).toBeInTheDocument()
      expect(screen.queryByText('Device Offline')).not.toBeInTheDocument()
    })

    it('filters to environmental alerts', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      await user.click(screen.getByRole('tab', { name: /environmental/i }))
      
      expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      expect(screen.queryByText('Security Alert')).not.toBeInTheDocument()
    })
  })

  describe('View Mode Toggle', () => {
    it('defaults to cards view', async () => {
      render(<AlertsList />)
      
      await waitFor(() => {
        // Cards view should show collapsed groups
        expect(screen.getByText(/critical/i)).toBeInTheDocument()
      })
    })

    it('switches to table view', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const tableViewButton = screen.getByRole('button', { name: /table view/i })
      await user.click(tableViewButton)
      
      // Table should have headers
      expect(screen.getByRole('columnheader', { name: /severity/i })).toBeInTheDocument()
    })

    it('switches back to cards view', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const tableViewButton = screen.getByRole('button', { name: /table view/i })
      await user.click(tableViewButton)
      
      const cardsViewButton = screen.getByRole('button', { name: /cards view/i })
      await user.click(cardsViewButton)
      
      // Back to cards view
      expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    it('filters alerts by search term', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText(/search alerts/i)
      await user.type(searchInput, 'temperature')
      
      expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      expect(screen.queryByText('Device Offline')).not.toBeInTheDocument()
    })

    it('searches by device name', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Sensor A')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText(/search alerts/i)
      await user.type(searchInput, 'Sensor B')
      
      expect(screen.getByText('Device Offline')).toBeInTheDocument()
      expect(screen.queryByText('Temperature Threshold Exceeded')).not.toBeInTheDocument()
    })

    it('shows no results message when search returns nothing', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText(/search alerts/i)
      await user.type(searchInput, 'nonexistent')
      
      expect(screen.getByText(/no alerts found/i)).toBeInTheDocument()
    })

    it('clears search when input is cleared', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText(/search alerts/i)
      await user.type(searchInput, 'temperature')
      await user.clear(searchInput)
      
      expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      expect(screen.getByText('Device Offline')).toBeInTheDocument()
    })
  })

  describe('Severity Filtering', () => {
    it('filters by critical severity', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const severitySelect = screen.getByLabelText(/severity/i)
      await user.click(severitySelect)
      await user.click(screen.getByText('Critical'))
      
      expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      expect(screen.getByText('Security Alert')).toBeInTheDocument()
      expect(screen.queryByText('Low Battery')).not.toBeInTheDocument() // Medium
    })

    it('filters by high severity', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Device Offline')).toBeInTheDocument()
      })
      
      const severitySelect = screen.getByLabelText(/severity/i)
      await user.click(severitySelect)
      await user.click(screen.getByText('High'))
      
      expect(screen.getByText('Device Offline')).toBeInTheDocument()
      expect(screen.queryByText('Temperature Threshold Exceeded')).not.toBeInTheDocument()
    })
  })

  describe('Category Filtering', () => {
    it('filters by temperature category', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const categorySelect = screen.getByLabelText(/category/i)
      await user.click(categorySelect)
      await user.click(screen.getByText('Temperature'))
      
      expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      expect(screen.queryByText('Device Offline')).not.toBeInTheDocument()
    })

    it('combines severity and category filters', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const severitySelect = screen.getByLabelText(/severity/i)
      await user.click(severitySelect)
      await user.click(screen.getByText('Critical'))
      
      const categorySelect = screen.getByLabelText(/category/i)
      await user.click(categorySelect)
      await user.click(screen.getByText('Security'))
      
      expect(screen.getByText('Security Alert')).toBeInTheDocument()
      expect(screen.queryByText('Temperature Threshold Exceeded')).not.toBeInTheDocument()
    })
  })

  describe('Alert Acknowledgment', () => {
    it('acknowledges single alert', async () => {
      const user = userEvent.setup()
      ;(edgeFunctions.alerts.acknowledge as jest.Mock).mockResolvedValue({
        success: true,
      })
      
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const acknowledgeButton = screen.getAllByRole('button', { name: /acknowledge/i })[0]
      await user.click(acknowledgeButton)
      
      await waitFor(() => {
        expect(edgeFunctions.alerts.acknowledge).toHaveBeenCalledWith('alert-1')
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('acknowledged'))
      })
    })

    it('handles acknowledgment error', async () => {
      const user = userEvent.setup()
      ;(edgeFunctions.alerts.acknowledge as jest.Mock).mockRejectedValue(
        new Error('Failed to acknowledge')
      )
      
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const acknowledgeButton = screen.getAllByRole('button', { name: /acknowledge/i })[0]
      await user.click(acknowledgeButton)
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })
    })

    it('refreshes alerts after acknowledgment', async () => {
      const user = userEvent.setup()
      ;(edgeFunctions.alerts.acknowledge as jest.Mock).mockResolvedValue({
        success: true,
      })
      
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const acknowledgeButton = screen.getAllByRole('button', { name: /acknowledge/i })[0]
      await user.click(acknowledgeButton)
      
      await waitFor(() => {
        expect(edgeFunctions.alerts.list).toHaveBeenCalledTimes(2) // Initial + refresh
      })
    })
  })

  describe('Bulk Operations', () => {
    it('selects multiple alerts', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])
      
      expect(screen.getByText(/2 selected/i)).toBeInTheDocument()
    })

    it('selects all alerts', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const selectAllButton = screen.getByRole('button', { name: /select all/i })
      await user.click(selectAllButton)
      
      expect(screen.getByText(/4 selected/i)).toBeInTheDocument()
    })

    it('acknowledges multiple alerts', async () => {
      const user = userEvent.setup()
      ;(edgeFunctions.alerts.acknowledgeMultiple as jest.Mock).mockResolvedValue({
        success: true,
      })
      
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])
      
      const bulkAcknowledgeButton = screen.getByRole('button', { name: /acknowledge selected/i })
      await user.click(bulkAcknowledgeButton)
      
      await waitFor(() => {
        expect(edgeFunctions.alerts.acknowledgeMultiple).toHaveBeenCalledWith(
          expect.arrayContaining(['alert-1', 'alert-2'])
        )
      })
    })

    it('clears selection after bulk operation', async () => {
      const user = userEvent.setup()
      ;(edgeFunctions.alerts.acknowledgeMultiple as jest.Mock).mockResolvedValue({
        success: true,
      })
      
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      
      const bulkAcknowledgeButton = screen.getByRole('button', { name: /acknowledge selected/i })
      await user.click(bulkAcknowledgeButton)
      
      await waitFor(() => {
        expect(screen.queryByText(/selected/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Alert Details Modal', () => {
    it('opens alert details on click', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      await user.click(screen.getByText('Temperature Threshold Exceeded'))
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/alert details/i)).toBeInTheDocument()
    })

    it('displays alert metadata in details modal', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      await user.click(screen.getByText('Temperature Threshold Exceeded'))
      
      expect(screen.getByText(/current value/i)).toBeInTheDocument()
      expect(screen.getByText('85')).toBeInTheDocument()
    })

    it('closes modal on close button click', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      await user.click(screen.getByText('Temperature Threshold Exceeded'))
      
      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('Grouped Alerts (Cards View)', () => {
    it('groups alerts by severity', async () => {
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText(/critical/i)).toBeInTheDocument()
        expect(screen.getByText(/high/i)).toBeInTheDocument()
        expect(screen.getByText(/medium/i)).toBeInTheDocument()
      })
    })

    it('collapses and expands groups', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const criticalGroup = screen.getByText(/critical.*2/i)
      await user.click(criticalGroup)
      
      // Alerts should be hidden
      expect(screen.queryByText('Temperature Threshold Exceeded')).not.toBeVisible()
    })

    it('shows count for each severity group', async () => {
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText(/critical.*2/i)).toBeInTheDocument()
        expect(screen.getByText(/high.*1/i)).toBeInTheDocument()
        expect(screen.getByText(/medium.*1/i)).toBeInTheDocument()
      })
    })
  })

  describe('Empty States', () => {
    it('shows message when no alerts exist', async () => {
      ;(edgeFunctions.alerts.list as jest.Mock).mockResolvedValue({
        success: true,
        data: { alerts: [] },
      })
      
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText(/no alerts found/i)).toBeInTheDocument()
      })
    })

    it('shows message when filters return no results', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText(/search alerts/i)
      await user.type(searchInput, 'nonexistent alert')
      
      expect(screen.getByText(/no alerts found/i)).toBeInTheDocument()
    })

    it('shows message when tab has no alerts', async () => {
      ;(edgeFunctions.alerts.list as jest.Mock).mockResolvedValue({
        success: true,
        data: { alerts: [mockAlerts[0]] }, // Only temperature alert
      })
      
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      await user.click(screen.getByRole('tab', { name: /security/i }))
      
      expect(screen.getByText(/no security alerts/i)).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('shows error message when fetch fails', async () => {
      ;(edgeFunctions.alerts.list as jest.Mock).mockRejectedValue(
        new Error('Failed to fetch alerts')
      )
      
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })
    })

    it('shows error message when organization is missing', async () => {
      render(<AlertsList />, {
        organizationValue: {
          currentOrganization: null,
          organizations: [],
          setCurrentOrganization: jest.fn(),
          loading: false,
          error: null,
        },
      })
      
      await waitFor(() => {
        expect(screen.getByText(/no organization selected/i)).toBeInTheDocument()
      })
    })

    it('retries fetch after error', async () => {
      ;(edgeFunctions.alerts.list as jest.Mock)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          success: true,
          data: { alerts: mockAlerts },
        })
      
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })
      
      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
    })
  })

  describe('Refresh Functionality', () => {
    it('refreshes alerts on refresh button click', async () => {
      const user = userEvent.setup()
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshButton)
      
      await waitFor(() => {
        expect(edgeFunctions.alerts.list).toHaveBeenCalledTimes(2)
      })
    })

    it('shows loading state during refresh', async () => {
      const user = userEvent.setup()
      ;(edgeFunctions.alerts.list as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { alerts: mockAlerts },
        }), 1000))
      )
      
      render(<AlertsList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Threshold Exceeded')).toBeInTheDocument()
      })
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshButton)
      
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })
})
