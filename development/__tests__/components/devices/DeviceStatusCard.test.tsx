/**
 * Unit Tests for DeviceStatusCard Component (Devices)
 *
 * Tests coverage:
 * - Loading state
 * - Error handling
 * - Status display (online/offline/warning/error/unknown)
 * - Last seen timestamp formatting
 * - Device type display
 * - Firmware information
 * - Health metrics (battery, signal, temperature)
 * - Provider information
 * - Refresh functionality
 * - Show/hide details
 */

import { render, screen, waitFor, userEvent } from '../../utils/test-utils'
import { DeviceStatusCard } from '@/components/devices/DeviceStatusCard'
import { useDeviceStatus } from '@/hooks/useDeviceStatus'

// Mock useDeviceStatus hook
jest.mock('@/hooks/useDeviceStatus')

const mockUseDeviceStatus = useDeviceStatus as jest.MockedFunction<
  typeof useDeviceStatus
>

describe('DeviceStatusCard Component (Devices)', () => {
  const mockStatus = {
    id: 'device-1',
    name: 'Temperature Sensor A',
    status: 'online' as const,
    lastSeen: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    deviceType: 'sensor',
    firmware: {
      version: '1.2.3',
      components: [
        { name: 'bootloader', version: '1.0.0' },
        { name: 'application', version: '1.2.3' },
      ],
    },
    health: {
      battery: 85,
      signalStrength: -65,
      temperature: 22,
    },
    providerType: 'golioth',
    externalDeviceId: 'external-123',
    cohortId: 'production',
  }

  const mockRefresh = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseDeviceStatus.mockReturnValue({
      status: mockStatus,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    })
  })

  describe('Loading State', () => {
    it('displays loading skeleton', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: null,
        isLoading: true,
        error: null,
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      expect(
        screen.getByTestId('loading-skeleton') ||
          document.querySelector('.animate-pulse')
      ).toBeInTheDocument()
    })

    it('shows loading animation elements', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: null,
        isLoading: true,
        error: null,
        refresh: mockRefresh,
      })

      const { container } = render(<DeviceStatusCard deviceId="device-1" />)

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('displays error message', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: null,
        isLoading: false,
        error: new Error('Failed to fetch device status'),
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      expect(
        screen.getByText(/error loading device status/i)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/failed to fetch device status/i)
      ).toBeInTheDocument()
    })

    it('displays retry button on error', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: null,
        isLoading: false,
        error: new Error('Network error'),
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('calls refresh when retry button clicked', async () => {
      const user = userEvent.setup()
      mockUseDeviceStatus.mockReturnValue({
        status: null,
        isLoading: false,
        error: new Error('Network error'),
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      await user.click(screen.getByRole('button', { name: /retry/i }))

      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  describe('Status Display', () => {
    it('displays online status', () => {
      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/online/i)).toBeInTheDocument()
    })

    it('displays offline status', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: { ...mockStatus, status: 'offline' },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/offline/i)).toBeInTheDocument()
    })

    it('displays warning status', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: { ...mockStatus, status: 'warning' },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/warning/i)).toBeInTheDocument()
    })

    it('displays error status', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: { ...mockStatus, status: 'error' },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })

    it('displays unknown status', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: { ...mockStatus, status: 'unknown' },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/unknown/i)).toBeInTheDocument()
    })

    it('displays device name', () => {
      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/temperature sensor a/i)).toBeInTheDocument()
    })

    it('shows status indicator color', () => {
      const { container } = render(<DeviceStatusCard deviceId="device-1" />)

      expect(container.querySelector('.bg-green-500')).toBeInTheDocument()
    })
  })

  describe('Timestamp Formatting', () => {
    it('formats recent timestamp as minutes ago', () => {
      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/5m ago/i)).toBeInTheDocument()
    })

    it('formats timestamp as hours ago', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: {
          ...mockStatus,
          lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/2h ago/i)).toBeInTheDocument()
    })

    it('formats timestamp as days ago', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: {
          ...mockStatus,
          lastSeen: new Date(
            Date.now() - 3 * 24 * 60 * 60 * 1000
          ).toISOString(), // 3 days ago
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/3d ago/i)).toBeInTheDocument()
    })

    it('shows "just now" for very recent timestamps', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: {
          ...mockStatus,
          lastSeen: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/just now/i)).toBeInTheDocument()
    })

    it('shows "never" for null timestamp', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: {
          ...mockStatus,
          lastSeen: null,
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/never/i)).toBeInTheDocument()
    })
  })

  describe('Device Information', () => {
    it('displays device type', () => {
      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/sensor/i)).toBeInTheDocument()
    })

    it('displays firmware version', () => {
      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/1\.2\.3/)).toBeInTheDocument()
    })

    it('displays firmware components', () => {
      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/bootloader.*1\.0\.0/i)).toBeInTheDocument()
      expect(screen.getByText(/application.*1\.2\.3/i)).toBeInTheDocument()
    })

    it('hides firmware when not available', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: { ...mockStatus, firmware: undefined },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.queryByText(/firmware/i)).not.toBeInTheDocument()
    })
  })

  describe('Health Metrics', () => {
    it('displays battery level', () => {
      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/85%/)).toBeInTheDocument()
    })

    it('displays signal strength', () => {
      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/-65.*dBm/i)).toBeInTheDocument()
    })

    it('displays temperature', () => {
      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/22.*°C/i)).toBeInTheDocument()
    })

    it('hides health metrics when not available', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: { ...mockStatus, health: undefined },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.queryByText(/battery/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/signal/i)).not.toBeInTheDocument()
    })
  })

  describe('Provider Information', () => {
    it('displays provider type', () => {
      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/golioth/i)).toBeInTheDocument()
    })

    it('displays external device ID', () => {
      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/external-123/)).toBeInTheDocument()
    })

    it('displays cohort ID', () => {
      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/production/i)).toBeInTheDocument()
    })

    it('hides external ID when not available', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: { ...mockStatus, externalDeviceId: undefined },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.queryByText(/external id/i)).not.toBeInTheDocument()
    })
  })

  describe('Refresh Functionality', () => {
    it('displays refresh button', () => {
      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByTitle(/refresh status/i)).toBeInTheDocument()
    })

    it('calls refresh when button clicked', async () => {
      const user = userEvent.setup()
      render(<DeviceStatusCard deviceId="device-1" />)

      await user.click(screen.getByTitle(/refresh status/i))

      expect(mockRefresh).toHaveBeenCalled()
    })

    it('shows loading animation during refresh', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: mockStatus,
        isLoading: true,
        error: null,
        refresh: mockRefresh,
      })

      const { container } = render(<DeviceStatusCard deviceId="device-1" />)

      expect(container.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })

  describe('Show/Hide Details', () => {
    it('shows details by default', () => {
      render(<DeviceStatusCard deviceId="device-1" />)

      expect(screen.getByText(/firmware/i)).toBeInTheDocument()
      expect(screen.getByText(/health/i)).toBeInTheDocument()
    })

    it('hides details when showDetails is false', () => {
      render(<DeviceStatusCard deviceId="device-1" showDetails={false} />)

      expect(screen.queryByText(/firmware/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/health/i)).not.toBeInTheDocument()
    })

    it('shows basic info even when details hidden', () => {
      render(<DeviceStatusCard deviceId="device-1" showDetails={false} />)

      expect(screen.getByText(/temperature sensor a/i)).toBeInTheDocument()
      expect(screen.getByText(/online/i)).toBeInTheDocument()
    })
  })

  describe('Empty States', () => {
    it('shows message when no status available', () => {
      mockUseDeviceStatus.mockReturnValue({
        status: null,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      })

      render(<DeviceStatusCard deviceId="device-1" />)

      expect(
        screen.getByText(/no device status available/i)
      ).toBeInTheDocument()
    })
  })

  describe('Refresh Interval', () => {
    it('uses custom refresh interval', () => {
      render(<DeviceStatusCard deviceId="device-1" refreshInterval={60000} />)

      expect(mockUseDeviceStatus).toHaveBeenCalledWith({
        deviceId: 'device-1',
        refreshInterval: 60000,
      })
    })

    it('uses default refresh interval', () => {
      render(<DeviceStatusCard deviceId="device-1" />)

      expect(mockUseDeviceStatus).toHaveBeenCalledWith({
        deviceId: 'device-1',
        refreshInterval: 30000,
      })
    })
  })
})
