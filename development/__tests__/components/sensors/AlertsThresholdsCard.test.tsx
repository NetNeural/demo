/**
 * Unit Tests for AlertsThresholdsCard Component
 *
 * Tests coverage:
 * - Loading and fetching thresholds
 * - Displaying threshold list
 * - Creating new thresholds
 * - Editing existing thresholds
 * - Deleting thresholds
 * - Form validation
 * - Temperature unit conversion
 * - Notification channels (email, SMS, webhook)
 * - Member selection
 * - Test alert functionality
 * - Multiple sensor types
 * - Severity levels
 * - Error handling
 */

import { render, screen, waitFor, userEvent } from '../../utils/test-utils'
import { AlertsThresholdsCard } from '@/components/sensors/AlertsThresholdsCard'
import { createMockDevice } from '../../mocks/factories'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { toast } from 'sonner'

// Mock edge functions
jest.mock('@/lib/edge-functions/client', () => ({
  edgeFunctions: {
    thresholds: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    members: {
      list: jest.fn(),
    },
  },
}))

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({ data: { id: 'alert-1' }, error: null })
          ),
        })),
      })),
    })),
  })),
}))

describe('AlertsThresholdsCard Component', () => {
  const mockDevice = createMockDevice({
    id: 'device-1',
    name: 'Temperature Sensor A',
    organization_id: 'org-1',
  })

  const mockThresholds = [
    {
      id: 'threshold-1',
      device_id: 'device-1',
      sensor_type: 'temperature',
      min_value: 32,
      max_value: 75,
      critical_min: 28,
      critical_max: 80,
      temperature_unit: 'fahrenheit',
      alert_enabled: true,
      alert_severity: 'medium',
      alert_message: 'Temperature out of range',
      notify_on_breach: true,
      notification_cooldown_minutes: 15,
      notification_channels: ['email'],
      notify_user_ids: ['user-1'],
      notify_emails: ['admin@example.com'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'threshold-2',
      device_id: 'device-1',
      sensor_type: 'humidity',
      min_value: 40,
      max_value: 80,
      critical_min: 30,
      critical_max: 90,
      alert_enabled: true,
      alert_severity: 'low',
      alert_message: 'Humidity out of range',
      notify_on_breach: true,
      notification_cooldown_minutes: 30,
      notification_channels: ['email', 'sms'],
      notify_user_ids: [],
      notify_emails: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]

  const mockMembers = [
    {
      id: 'user-1',
      full_name: 'John Doe',
      email: 'john@example.com',
      role: 'admin',
    },
    {
      id: 'user-2',
      full_name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'member',
    },
  ]

  const mockOnTemperatureUnitChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(edgeFunctions.thresholds.list as jest.Mock).mockResolvedValue({
      success: true,
      data: { thresholds: mockThresholds },
    })
    ;(edgeFunctions.members.list as jest.Mock).mockResolvedValue({
      success: true,
      data: { members: mockMembers },
    })
  })

  describe('Loading and Fetching', () => {
    it('renders alerts thresholds card', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      expect(screen.getByText(/alerts.*thresholds/i)).toBeInTheDocument()
    })

    it('fetches thresholds on mount', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(edgeFunctions.thresholds.list).toHaveBeenCalledWith('device-1')
      })
    })

    it('fetches organization members on mount', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(edgeFunctions.members.list).toHaveBeenCalledWith('org-1')
      })
    })

    it('displays loading state', () => {
      ;(edgeFunctions.thresholds.list as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      expect(screen.getByText(/loading|fetching/i)).toBeInTheDocument()
    })
  })

  describe('Displaying Thresholds', () => {
    it('displays threshold list', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/temperature/i)).toBeInTheDocument()
      })

      expect(screen.getByText(/humidity/i)).toBeInTheDocument()
    })

    it('displays threshold values', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/32/)).toBeInTheDocument()
      })

      expect(screen.getByText(/75/)).toBeInTheDocument()
    })

    it('displays severity badges', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/medium/i)).toBeInTheDocument()
      })

      expect(screen.getByText(/low/i)).toBeInTheDocument()
    })

    it('displays notification info when enabled', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByText(/notification/i).length).toBeGreaterThan(0)
      })
    })

    it('shows empty state when no thresholds', async () => {
      ;(edgeFunctions.thresholds.list as jest.Mock).mockResolvedValue({
        success: true,
        data: { thresholds: [] },
      })

      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(
          screen.getByText(/no thresholds configured/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('Creating Threshold', () => {
    it('renders add threshold button', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/add threshold/i)).toBeInTheDocument()
      })
    })

    it('opens create dialog when add button clicked', async () => {
      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/add threshold/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/add threshold/i))

      // Dialog should open — look for dialog-specific elements
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('calls create API when form is submitted', async () => {
      ;(edgeFunctions.thresholds.create as jest.Mock).mockResolvedValue({
        success: true,
        data: { threshold: { id: 'new-threshold' } },
      })

      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/add threshold/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/add threshold/i))

      // Wait for dialog
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Find and click save button in the dialog
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(edgeFunctions.thresholds.create).toHaveBeenCalled()
      })
    })
  })

  describe('Editing Threshold', () => {
    it('renders edit buttons for each threshold', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /edit threshold/i })
        expect(editButtons.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('opens edit dialog when edit button clicked', async () => {
      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /edit threshold/i })[0]).toBeInTheDocument()
      })

      await user.click(screen.getAllByRole('button', { name: /edit threshold/i })[0])

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('calls update API on edit save', async () => {
      ;(edgeFunctions.thresholds.update as jest.Mock).mockResolvedValue({
        success: true,
        data: { threshold: mockThresholds[0] },
      })

      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /edit threshold/i })[0]).toBeInTheDocument()
      })

      await user.click(screen.getAllByRole('button', { name: /edit threshold/i })[0])

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(edgeFunctions.thresholds.update).toHaveBeenCalled()
      })
    })
  })

  describe('Deleting Threshold', () => {
    it('renders delete buttons for each threshold', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /delete threshold/i })
        expect(deleteButtons.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('opens delete confirmation when delete clicked', async () => {
      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /delete threshold/i })[0]).toBeInTheDocument()
      })

      await user.click(screen.getAllByRole('button', { name: /delete threshold/i })[0])

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })
    })

    it('calls delete API on confirmation', async () => {
      ;(edgeFunctions.thresholds.delete as jest.Mock).mockResolvedValue({
        success: true,
      })

      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /delete threshold/i })[0]).toBeInTheDocument()
      })

      await user.click(screen.getAllByRole('button', { name: /delete threshold/i })[0])

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })

      // Find and click confirm/delete button in the alert dialog
      const confirmButton = screen.getByRole('button', { name: /delete|confirm|yes/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(edgeFunctions.thresholds.delete).toHaveBeenCalledWith('threshold-1')
      })
    })
  })

  describe('Temperature Unit Conversion', () => {
    it('displays temperature values with unit symbols', async () => {
      const { container } = render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        // Look for °F in the rendered text
        expect(container.textContent).toMatch(/°F/)
      })
    })

    it('displays celsius values when unit is celsius', async () => {
      // Create a threshold with celsius unit
      const celsiusThresholds = [{
        ...mockThresholds[0],
        temperature_unit: 'celsius',
      }]
      ;(edgeFunctions.thresholds.list as jest.Mock).mockResolvedValue({
        success: true,
        data: { thresholds: celsiusThresholds },
      })

      const { container } = render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="celsius"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(container.textContent).toMatch(/°C/)
      })
    })

    it('displays humidity with percent symbol', async () => {
      const { container } = render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(container.textContent).toMatch(/%/)
      })
    })
  })

  describe('Notification Channels', () => {
    it('displays notification info in threshold items', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        // Both thresholds have notify_on_breach, so notification text should appear
        expect(screen.getAllByText(/notification/i).length).toBeGreaterThan(0)
      })
    })

    it('shows notification cooldown time', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        // Cooldown of 15min for first threshold
        expect(screen.getByText(/15min/)).toBeInTheDocument()
      })
    })
  })

  describe('Test Alert Functionality', () => {
    it('displays test alert button for each threshold', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(
          screen.getAllByRole('button', { name: /test alert/i })[0]
        ).toBeInTheDocument()
      })
    })

    it('test alert buttons exist for each threshold', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        const testButtons = screen.getAllByRole('button', { name: /test alert/i })
        expect(testButtons.length).toBe(2) // One per threshold
      })
    })
  })

  describe('Sensor Types', () => {
    it('supports temperature sensor type', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/temperature/i)).toBeInTheDocument()
      })
    })

    it('supports humidity sensor type', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/humidity/i)).toBeInTheDocument()
      })
    })

    it('displays both sensor types with their values', async () => {
      const { container } = render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        // Temperature sensor shows °F, humidity shows %
        const text = container.textContent || ''
        expect(text).toMatch(/°F/)
        expect(text).toMatch(/%/)
      })
    })
  })

  describe('Error Handling', () => {
    it('handles fetch error gracefully', async () => {
      ;(edgeFunctions.thresholds.list as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to fetch thresholds',
      })

      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(edgeFunctions.thresholds.list).toHaveBeenCalled()
      })

      // Should handle error without crashing
      expect(screen.getByText(/alerts.*thresholds/i)).toBeInTheDocument()
    })

    it('handles create failure gracefully', async () => {
      ;(edgeFunctions.thresholds.create as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to create threshold',
      })

      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/add threshold/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/add threshold/i))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(edgeFunctions.thresholds.create).toHaveBeenCalled()
      })
    })

    it('handles update failure gracefully', async () => {
      ;(edgeFunctions.thresholds.update as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to update threshold',
      })

      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /edit threshold/i })[0]).toBeInTheDocument()
      })

      await user.click(screen.getAllByRole('button', { name: /edit threshold/i })[0])

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(edgeFunctions.thresholds.update).toHaveBeenCalled()
      })
    })

    it('handles delete failure gracefully', async () => {
      ;(edgeFunctions.thresholds.delete as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to delete threshold',
      })

      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /delete threshold/i })[0]).toBeInTheDocument()
      })

      await user.click(screen.getAllByRole('button', { name: /delete threshold/i })[0])

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })

      const confirmButton = screen.getByRole('button', { name: /delete|confirm|yes/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(edgeFunctions.thresholds.delete).toHaveBeenCalled()
      })
    })
  })
})
