/**
 * Unit Tests for DevicesList Component
 * 
 * Tests coverage:
 * - Rendering and initial load
 * - Device filtering by type and status
 * - Search functionality
 * - Sorting (name, status, last seen, battery)
 * - Temperature unit toggle
 * - Pagination
 * - CSV export functionality
 * - Device actions (view details, edit, delete)
 * - Telemetry display
 * - Location display
 * - Integration status
 * - Empty states
 * - Error handling
 */

import { render, screen, waitFor, within } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { DevicesList } from '@/components/devices/DevicesList'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { toast } from 'sonner'
import { createMockDevice, resetMockCounter } from '../../mocks/factories'

// Mock dependencies
jest.mock('@/lib/edge-functions/client', () => ({
  edgeFunctions: {
    devices: {
      list: jest.fn(),
      delete: jest.fn(),
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

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}))

describe('DevicesList Component', () => {
  const mockDevices = [
    {
      id: 'device-1',
      name: 'Temperature Sensor A',
      device_type: 'sensor',
      model: 'TH-100',
      status: 'online' as const,
      lastSeen: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      batteryLevel: 85,
      signal_strength: 95,
      firmware_version: '1.2.3',
      location_id: 'loc-1',
      telemetry: {
        temperature: { value: 72.5, unit: '°F', timestamp: new Date() },
      },
    },
    {
      id: 'device-2',
      name: 'Humidity Sensor B',
      device_type: 'sensor',
      model: 'HU-200',
      status: 'offline' as const,
      lastSeen: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      batteryLevel: 45,
      signal_strength: 60,
      firmware_version: '1.1.0',
      location_id: 'loc-2',
    },
    {
      id: 'device-3',
      name: 'Gateway Device',
      device_type: 'gateway',
      model: 'GW-300',
      status: 'warning' as const,
      lastSeen: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      batteryLevel: 20,
      signal_strength: 85,
      firmware_version: '2.0.0',
      location_id: 'loc-1',
    },
    {
      id: 'device-4',
      name: 'Pressure Sensor',
      device_type: 'sensor',
      model: 'PR-400',
      status: 'online' as const,
      lastSeen: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      batteryLevel: 100,
      signal_strength: 90,
      firmware_version: '1.3.0',
      isExternallyManaged: true,
      externalDeviceId: 'ext-123',
      integrationName: 'Golioth',
    },
  ]

  const mockLocations = [
    { id: 'loc-1', name: 'Building A' },
    { id: 'loc-2', name: 'Building B' },
  ]

  beforeEach(() => {
    resetMockCounter()
    jest.clearAllMocks()
    
    // Default mock responses
    ;(edgeFunctions.devices.list as jest.Mock).mockResolvedValue({
      success: true,
      data: mockDevices,
    })
  })

  describe('Rendering and Initial Load', () => {
    it('renders devices list container', async () => {
      render(<DevicesList />)
      
      expect(screen.getByText(/devices/i)).toBeInTheDocument()
    })

    it('shows loading state while fetching', () => {
      render(<DevicesList />)
      
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('fetches devices on mount', async () => {
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(edgeFunctions.devices.list).toHaveBeenCalledWith(
          expect.any(String)
        )
      })
    })

    it('displays devices after loading', async () => {
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
        expect(screen.getByText('Humidity Sensor B')).toBeInTheDocument()
        expect(screen.getByText('Gateway Device')).toBeInTheDocument()
      })
    })

    it('displays device count', async () => {
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText(/4 devices/i)).toBeInTheDocument()
      })
    })

    it('displays status indicators', async () => {
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText(/online/i)).toBeInTheDocument()
        expect(screen.getByText(/offline/i)).toBeInTheDocument()
        expect(screen.getByText(/warning/i)).toBeInTheDocument()
      })
    })
  })

  describe('Device Type Filtering', () => {
    it('shows all devices by default', async () => {
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
        expect(screen.getByText('Gateway Device')).toBeInTheDocument()
      })
    })

    it('filters devices by sensor type', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
      
      const typeFilter = screen.getByLabelText(/device type/i)
      await user.click(typeFilter)
      await user.click(screen.getByText(/^sensor$/i))
      
      expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      expect(screen.queryByText('Gateway Device')).not.toBeInTheDocument()
    })

    it('filters devices by gateway type', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Gateway Device')).toBeInTheDocument()
      })
      
      const typeFilter = screen.getByLabelText(/device type/i)
      await user.click(typeFilter)
      await user.click(screen.getByText(/^gateway$/i))
      
      expect(screen.getByText('Gateway Device')).toBeInTheDocument()
      expect(screen.queryByText('Temperature Sensor A')).not.toBeInTheDocument()
    })

    it('resets filter to show all devices', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
      
      const typeFilter = screen.getByLabelText(/device type/i)
      await user.click(typeFilter)
      await user.click(screen.getByText(/^sensor$/i))
      
      await user.click(typeFilter)
      await user.click(screen.getByText(/all/i))
      
      expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      expect(screen.getByText('Gateway Device')).toBeInTheDocument()
    })
  })

  describe('Status Filtering', () => {
    it('filters by online status', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
      
      const statusFilter = screen.getByLabelText(/status/i)
      await user.click(statusFilter)
      await user.click(screen.getByText(/^online$/i))
      
      expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      expect(screen.queryByText('Humidity Sensor B')).not.toBeInTheDocument() // offline
    })

    it('filters by offline status', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Humidity Sensor B')).toBeInTheDocument()
      })
      
      const statusFilter = screen.getByLabelText(/status/i)
      await user.click(statusFilter)
      await user.click(screen.getByText(/^offline$/i))
      
      expect(screen.getByText('Humidity Sensor B')).toBeInTheDocument()
      expect(screen.queryByText('Temperature Sensor A')).not.toBeInTheDocument()
    })

    it('combines type and status filters', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
      
      const typeFilter = screen.getByLabelText(/device type/i)
      await user.click(typeFilter)
      await user.click(screen.getByText(/^sensor$/i))
      
      const statusFilter = screen.getByLabelText(/status/i)
      await user.click(statusFilter)
      await user.click(screen.getByText(/^online$/i))
      
      expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      expect(screen.getByText('Pressure Sensor')).toBeInTheDocument()
      expect(screen.queryByText('Gateway Device')).not.toBeInTheDocument()
      expect(screen.queryByText('Humidity Sensor B')).not.toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    it('searches devices by name', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText(/search devices/i)
      await user.type(searchInput, 'Temperature')
      
      expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      expect(screen.queryByText('Humidity Sensor B')).not.toBeInTheDocument()
    })

    it('searches devices by model', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Gateway Device')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText(/search devices/i)
      await user.type(searchInput, 'GW-300')
      
      expect(screen.getByText('Gateway Device')).toBeInTheDocument()
      expect(screen.queryByText('Temperature Sensor A')).not.toBeInTheDocument()
    })

    it('shows no results message when search returns nothing', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText(/search devices/i)
      await user.type(searchInput, 'nonexistent device')
      
      expect(screen.getByText(/no devices found/i)).toBeInTheDocument()
    })

    it('clears search results when input is cleared', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText(/search devices/i)
      await user.type(searchInput, 'Temperature')
      await user.clear(searchInput)
      
      expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      expect(screen.getByText('Humidity Sensor B')).toBeInTheDocument()
    })
  })

  describe('Sorting', () => {
    it('sorts devices by name (A-Z)', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
      
      const sortButton = screen.getByRole('button', { name: /sort by name/i })
      await user.click(sortButton)
      
      const deviceNames = screen.getAllByRole('heading', { level: 3 })
      expect(deviceNames[0]).toHaveTextContent('Gateway Device')
      expect(deviceNames[1]).toHaveTextContent('Humidity Sensor B')
    })

    it('sorts devices by status', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
      
      const sortSelect = screen.getByLabelText(/sort by/i)
      await user.click(sortSelect)
      await user.click(screen.getByText(/status/i))
      
      // Online devices should come first
      const deviceCards = screen.getAllByTestId(/device-card/i)
      expect(within(deviceCards[0]).getByText(/online/i)).toBeInTheDocument()
    })

    it('sorts devices by battery level', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
      
      const sortSelect = screen.getByLabelText(/sort by/i)
      await user.click(sortSelect)
      await user.click(screen.getByText(/battery/i))
      
      // 100% battery device should be first
      const deviceCards = screen.getAllByTestId(/device-card/i)
      expect(within(deviceCards[0]).getByText('Pressure Sensor')).toBeInTheDocument()
    })

    it('reverses sort order on second click', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
      
      const sortButton = screen.getByRole('button', { name: /sort by name/i })
      await user.click(sortButton) // A-Z
      await user.click(sortButton) // Z-A
      
      const deviceNames = screen.getAllByRole('heading', { level: 3 })
      expect(deviceNames[0]).toHaveTextContent('Temperature Sensor A')
    })
  })

  describe('Temperature Unit Toggle', () => {
    it('displays temperature in Fahrenheit by default', async () => {
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText(/72\.5.*°F/i)).toBeInTheDocument()
      })
    })

    it('toggles temperature to Celsius', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText(/72\.5.*°F/i)).toBeInTheDocument()
      })
      
      const tempToggle = screen.getByRole('switch', { name: /temperature unit/i })
      await user.click(tempToggle)
      
      expect(screen.getByText(/22\.5.*°C/i)).toBeInTheDocument()
    })

    it('persists temperature preference', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText(/72\.5.*°F/i)).toBeInTheDocument()
      })
      
      const tempToggle = screen.getByRole('switch', { name: /temperature unit/i })
      await user.click(tempToggle)
      
      // Re-render component
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText(/22\.5.*°C/i)).toBeInTheDocument()
      })
    })
  })

  describe('CSV Export', () => {
    it('exports devices to CSV', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
      
      const exportButton = screen.getByRole('button', { name: /export csv/i })
      await user.click(exportButton)
      
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining('exported')
        )
      })
    })

    it('shows progress during export', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
      
      const exportButton = screen.getByRole('button', { name: /export csv/i })
      await user.click(exportButton)
      
      expect(screen.getByText(/exporting/i)).toBeInTheDocument()
    })

    it('disables export button when no devices', async () => {
      ;(edgeFunctions.devices.list as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      })
      
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText(/no devices/i)).toBeInTheDocument()
      })
      
      const exportButton = screen.getByRole('button', { name: /export csv/i })
      expect(exportButton).toBeDisabled()
    })
  })

  describe('Pagination', () => {
    it('shows pagination controls when devices exceed page size', async () => {
      const manyDevices = Array.from({ length: 25 }, (_, i) => ({
        ...mockDevices[0],
        id: `device-${i}`,
        name: `Device ${i}`,
      }))
      
      ;(edgeFunctions.devices.list as jest.Mock).mockResolvedValue({
        success: true,
        data: manyDevices,
      })
      
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
      })
    })

    it('navigates to next page', async () => {
      const user = userEvent.setup()
      const manyDevices = Array.from({ length: 25 }, (_, i) => ({
        ...mockDevices[0],
        id: `device-${i}`,
        name: `Device ${i}`,
      }))
      
      ;(edgeFunctions.devices.list as jest.Mock).mockResolvedValue({
        success: true,
        data: manyDevices,
      })
      
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Device 0')).toBeInTheDocument()
      })
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      expect(screen.getByText('Device 20')).toBeInTheDocument()
      expect(screen.queryByText('Device 0')).not.toBeInTheDocument()
    })

    it('navigates to previous page', async () => {
      const user = userEvent.setup()
      const manyDevices = Array.from({ length: 25 }, (_, i) => ({
        ...mockDevices[0],
        id: `device-${i}`,
        name: `Device ${i}`,
      }))
      
      ;(edgeFunctions.devices.list as jest.Mock).mockResolvedValue({
        success: true,
        data: manyDevices,
      })
      
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Device 0')).toBeInTheDocument()
      })
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      const prevButton = screen.getByRole('button', { name: /previous/i })
      await user.click(prevButton)
      
      expect(screen.getByText('Device 0')).toBeInTheDocument()
    })

    it('disables previous button on first page', async () => {
      const manyDevices = Array.from({ length: 25 }, (_, i) => ({
        ...mockDevices[0],
        id: `device-${i}`,
        name: `Device ${i}`,
      }))
      
      ;(edgeFunctions.devices.list as jest.Mock).mockResolvedValue({
        success: true,
        data: manyDevices,
      })
      
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
      })
    })
  })

  describe('Device Details', () => {
    it('displays battery level', async () => {
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText(/85%/)).toBeInTheDocument()
      })
    })

    it('displays signal strength', async () => {
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText(/95%/)).toBeInTheDocument()
      })
    })

    it('displays firmware version', async () => {
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText(/1\.2\.3/)).toBeInTheDocument()
      })
    })

    it('displays last seen time', async () => {
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText(/5 minutes ago/i)).toBeInTheDocument()
      })
    })

    it('displays location name', async () => {
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText(/Building A/i)).toBeInTheDocument()
      })
    })

    it('shows integration badge for externally managed devices', async () => {
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText(/Golioth/i)).toBeInTheDocument()
      })
    })
  })

  describe('Empty States', () => {
    it('shows message when no devices exist', async () => {
      ;(edgeFunctions.devices.list as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      })
      
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText(/no devices found/i)).toBeInTheDocument()
      })
    })

    it('shows add device button in empty state', async () => {
      ;(edgeFunctions.devices.list as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      })
      
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add device/i })).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('shows error message when fetch fails', async () => {
      ;(edgeFunctions.devices.list as jest.Mock).mockRejectedValue(
        new Error('Failed to fetch devices')
      )
      
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })
    })

    it('shows retry button after error', async () => {
      ;(edgeFunctions.devices.list as jest.Mock).mockRejectedValue(
        new Error('Failed to fetch devices')
      )
      
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })

    it('retries fetch after error', async () => {
      ;(edgeFunctions.devices.list as jest.Mock)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          success: true,
          data: mockDevices,
        })
      
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })
      
      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
    })
  })

  describe('Refresh Functionality', () => {
    it('refreshes devices on refresh button click', async () => {
      const user = userEvent.setup()
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshButton)
      
      await waitFor(() => {
        expect(edgeFunctions.devices.list).toHaveBeenCalledTimes(2)
      })
    })

    it('shows loading spinner during refresh', async () => {
      const user = userEvent.setup()
      ;(edgeFunctions.devices.list as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: mockDevices,
        }), 1000))
      )
      
      render(<DevicesList />)
      
      await waitFor(() => {
        expect(screen.getByText('Temperature Sensor A')).toBeInTheDocument()
      })
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshButton)
      
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })
})
