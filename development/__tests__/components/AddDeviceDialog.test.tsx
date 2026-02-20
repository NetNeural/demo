/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddDeviceDialog } from '@/components/devices/AddDeviceDialog'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// Mock dependencies
jest.mock('@/contexts/OrganizationContext')
jest.mock('@/lib/supabase/client')
jest.mock('sonner')

const mockUseOrganization = useOrganization as jest.MockedFunction<typeof useOrganization>
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockToast = toast as jest.Mocked<typeof toast>

describe('AddDeviceDialog', () => {
  const mockOnOpenChange = jest.fn()
  const mockOnSuccess = jest.fn()
  
  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
  }

  const mockSupabaseClient = {
    from: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockUseOrganization.mockReturnValue({
      currentOrganization: mockOrganization,
    } as any)

    mockCreateClient.mockReturnValue(mockSupabaseClient as any)
  })

  it('renders when open', () => {
    render(
      <AddDeviceDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    )

    expect(screen.getByText('Add New Device')).toBeInTheDocument()
    expect(screen.getByText(/Register a new IoT device/)).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <AddDeviceDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    )

    expect(screen.queryByText('Add New Device')).not.toBeInTheDocument()
  })

  it('loads device types on open', async () => {
    const mockDeviceTypes = [
      { id: 'type-1', name: 'Temperature Sensor' },
      { id: 'type-2', name: 'Humidity Sensor' },
    ]

    const mockSelect = jest.fn().mockReturnThis()
    const mockEq = jest.fn().mockReturnThis()
    const mockOrder = jest.fn().mockResolvedValue({ data: mockDeviceTypes, error: null })

    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
    } as any)

    mockSelect.mockReturnValue({
      eq: mockEq,
    } as any)

    mockEq.mockReturnValue({
      order: mockOrder,
    } as any)

    render(
      <AddDeviceDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    )

    await waitFor(() => {
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('device_types')
    })
  })

  it('validates required fields', async () => {
    render(
      <AddDeviceDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    )

    const addButton = screen.getByRole('button', { name: /Add Device/i })
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Please enter a device name')
    })
  })

  it('creates device with valid data', async () => {
    const mockDeviceTypes = [
      { id: 'type-1', name: 'Temperature Sensor' },
    ]

    const mockSelect = jest.fn().mockReturnThis()
    const mockEq = jest.fn().mockReturnThis()
    const mockOrder = jest.fn().mockResolvedValue({ data: mockDeviceTypes, error: null })
    const mockInsert = jest.fn().mockReturnThis()
    const mockSingle = jest.fn().mockResolvedValue({ 
      data: { id: 'device-123' }, 
      error: null 
    })

    mockSupabaseClient.from.mockImplementation((table) => {
      if (table === 'device_types') {
        return {
          select: mockSelect,
        } as any
      }
      return {
        insert: mockInsert,
      } as any
    })

    mockSelect.mockReturnValue({
      eq: mockEq,
    } as any)

    mockEq.mockReturnValue({
      order: mockOrder,
    } as any)

    mockInsert.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      single: mockSingle,
    } as any)

    render(
      <AddDeviceDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    )

    // Wait for device types to load
    await waitFor(() => {
      expect(mockOrder).toHaveBeenCalled()
    })

    // Fill in form
    const nameInput = screen.getByLabelText(/Device Name/i)
    fireEvent.change(nameInput, { target: { value: 'Test Device' } })

    // Submit form
    const addButton = screen.getByRole('button', { name: /Add Device/i })
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalled()
      expect(mockOnSuccess).toHaveBeenCalled()
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('handles device creation error', async () => {
    const mockInsert = jest.fn().mockReturnThis()
    const mockSingle = jest.fn().mockResolvedValue({ 
      data: null, 
      error: new Error('Database error') 
    })

    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
      insert: mockInsert,
    } as any)

    mockInsert.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      single: mockSingle,
    } as any)

    render(
      <AddDeviceDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    )

    const nameInput = screen.getByLabelText(/Device Name/i)
    fireEvent.change(nameInput, { target: { value: 'Test Device' } })

    const addButton = screen.getByRole('button', { name: /Add Device/i })
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to add device')
    })
  })
})
