/**
 * Comprehensive Tests for Device Components
 *
 * Tests for DevicesHeader, DevicesList, TransferDeviceDialog, DeviceIntegrationManager
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DevicesHeader } from '@/components/devices/DevicesHeader'
import { DevicesList } from '@/components/devices/DevicesList'
import { TransferDeviceDialog } from '@/components/devices/TransferDeviceDialog'
import { DeviceIntegrationManager } from '@/components/devices/DeviceIntegrationManager'

// Mock dependencies
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
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

describe('DevicesHeader', () => {
  const mockOnNewDevice = jest.fn()
  const mockOnRefresh = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders header with title', () => {
    render(
      <DevicesHeader onNewDevice={mockOnNewDevice} onRefresh={mockOnRefresh} />
    )

    expect(screen.getByText(/devices/i)).toBeInTheDocument()
  })

  test('calls onNewDevice when add button clicked', async () => {
    render(
      <DevicesHeader onNewDevice={mockOnNewDevice} onRefresh={mockOnRefresh} />
    )

    const addButton = screen.getByRole('button', { name: /add|new/i })
    await userEvent.click(addButton)

    expect(mockOnNewDevice).toHaveBeenCalled()
  })

  test('calls onRefresh when refresh button clicked', async () => {
    render(
      <DevicesHeader onNewDevice={mockOnNewDevice} onRefresh={mockOnRefresh} />
    )

    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    await userEvent.click(refreshButton)

    expect(mockOnRefresh).toHaveBeenCalled()
  })

  test('displays device count when provided', () => {
    render(
      <DevicesHeader
        onNewDevice={mockOnNewDevice}
        onRefresh={mockOnRefresh}
        deviceCount={42}
      />
    )

    expect(screen.getByText(/42/)).toBeInTheDocument()
  })
})

describe('DevicesList', () => {
  const mockDevices = [
    {
      id: 'device-1',
      name: 'Temperature Sensor',
      status: 'online' as const,
      device_type: 'sensor',
      location: 'Room A',
      last_seen: new Date().toISOString(),
    },
    {
      id: 'device-2',
      name: 'Humidity Sensor',
      status: 'offline' as const,
      device_type: 'sensor',
      location: 'Room B',
      last_seen: new Date(Date.now() - 86400000).toISOString(),
    },
  ]

  test('renders empty state when no devices', () => {
    render(<DevicesList devices={[]} />)

    expect(screen.getByText(/no devices/i)).toBeInTheDocument()
  })

  test('renders device list with all devices', () => {
    render(<DevicesList devices={mockDevices} />)

    expect(screen.getByText('Temperature Sensor')).toBeInTheDocument()
    expect(screen.getByText('Humidity Sensor')).toBeInTheDocument()
  })

  test('displays device status indicators', () => {
    render(<DevicesList devices={mockDevices} />)

    expect(screen.getByText(/online/i)).toBeInTheDocument()
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })

  test('displays device locations', () => {
    render(<DevicesList devices={mockDevices} />)

    expect(screen.getByText(/room a/i)).toBeInTheDocument()
    expect(screen.getByText(/room b/i)).toBeInTheDocument()
  })

  test('handles click on device', async () => {
    const mockOnDeviceClick = jest.fn()
    render(
      <DevicesList devices={mockDevices} onDeviceClick={mockOnDeviceClick} />
    )

    const firstDevice = screen.getByText('Temperature Sensor')
    await userEvent.click(firstDevice)

    expect(mockOnDeviceClick).toHaveBeenCalledWith('device-1')
  })
})

describe('TransferDeviceDialog', () => {
  const mockDevice = {
    id: 'device-1',
    name: 'Test Device',
    organization_id: 'org-1',
  }

  const mockOrganizations = [
    { id: 'org-2', name: 'Org A' },
    { id: 'org-3', name: 'Org B' },
  ]

  test('renders dialog when open', () => {
    render(
      <TransferDeviceDialog
        open={true}
        onOpenChange={() => {}}
        device={mockDevice}
        organizations={mockOrganizations}
      />
    )

    expect(screen.getByText(/transfer device/i)).toBeInTheDocument()
  })

  test('does not render when closed', () => {
    render(
      <TransferDeviceDialog
        open={false}
        onOpenChange={() => {}}
        device={mockDevice}
        organizations={mockOrganizations}
      />
    )

    expect(screen.queryByText(/transfer device/i)).not.toBeInTheDocument()
  })

  test('displays device name', () => {
    render(
      <TransferDeviceDialog
        open={true}
        onOpenChange={() => {}}
        device={mockDevice}
        organizations={mockOrganizations}
      />
    )

    expect(screen.getByText(/test device/i)).toBeInTheDocument()
  })

  test('displays organization options', () => {
    render(
      <TransferDeviceDialog
        open={true}
        onOpenChange={() => {}}
        device={mockDevice}
        organizations={mockOrganizations}
      />
    )

    // Check that organization select is present
    expect(
      screen.getByRole('combobox') ||
        screen.getByRole('button', { name: /select|organization/i })
    ).toBeInTheDocument()
  })

  test('handles cancel action', async () => {
    const mockOnOpenChange = jest.fn()
    render(
      <TransferDeviceDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        device={mockDevice}
        organizations={mockOrganizations}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await userEvent.click(cancelButton)

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })
})

describe('DeviceIntegrationManager', () => {
  const mockDevice = {
    id: 'device-1',
    name: 'Test Device',
    integration_id: null,
  }

  test('renders integration manager component', () => {
    render(<DeviceIntegrationManager device={mockDevice} />)

    expect(screen.getByText(/integration/i)).toBeInTheDocument()
  })

  test('displays no integration state when device has no integration', () => {
    render(<DeviceIntegrationManager device={mockDevice} />)

    expect(
      screen.getByText(/no integration|not connected/i)
    ).toBeInTheDocument()
  })

  test('displays connect button when no integration', () => {
    render(<DeviceIntegrationManager device={mockDevice} />)

    expect(
      screen.getByRole('button', { name: /connect|add integration/i })
    ).toBeInTheDocument()
  })

  test('handles connect button click', async () => {
    render(<DeviceIntegrationManager device={mockDevice} />)

    const connectButton = screen.getByRole('button', {
      name: /connect|add integration/i,
    })
    await userEvent.click(connectButton)

    // Dialog should open
    await waitFor(() => {
      expect(
        screen.getByRole('dialog') || screen.getByText(/select integration/i)
      ).toBeInTheDocument()
    })
  })
})
