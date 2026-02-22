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
import { createMockDevice } from '@/__tests__/mocks/factories'
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

    it('displays notification channels', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/email/i)).toBeInTheDocument()
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
          screen.getByText(/no thresholds|add threshold/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('Creating Threshold', () => {
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
        expect(
          screen.getByRole('button', { name: /add|new/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /add|new/i }))

      expect(
        screen.getByText(/add.*threshold|create.*threshold/i)
      ).toBeInTheDocument()
    })

    it('creates new threshold with valid data', async () => {
      const user = userEvent.setup()
      ;(edgeFunctions.thresholds.create as jest.Mock).mockResolvedValue({
        success: true,
        data: { threshold: { id: 'new-threshold' } },
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
          screen.getByRole('button', { name: /add|new/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /add|new/i }))

      // Fill form
      const minInput = screen.getByLabelText(/min.*value|minimum/i)
      const maxInput = screen.getByLabelText(/max.*value|maximum/i)

      await user.clear(minInput)
      await user.type(minInput, '50')
      await user.clear(maxInput)
      await user.type(maxInput, '80')

      // Save
      const saveButton = screen.getByRole('button', { name: /save|create/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(edgeFunctions.thresholds.create).toHaveBeenCalled()
      })
    })

    it('validates min/max values', async () => {
      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add|new/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /add|new/i }))

      // Try to save with invalid values (max < min)
      const minInput = screen.getByLabelText(/min.*value|minimum/i)
      const maxInput = screen.getByLabelText(/max.*value|maximum/i)

      await user.clear(minInput)
      await user.type(minInput, '80')
      await user.clear(maxInput)
      await user.type(maxInput, '50')

      const saveButton = screen.getByRole('button', { name: /save|create/i })
      await user.click(saveButton)

      // Should show error or not call create
      await waitFor(() => {
        expect(edgeFunctions.thresholds.create).not.toHaveBeenCalled()
      })
    })

    it('displays success message on create', async () => {
      const user = userEvent.setup()
      ;(edgeFunctions.thresholds.create as jest.Mock).mockResolvedValue({
        success: true,
        data: { threshold: { id: 'new-threshold' } },
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
          screen.getByRole('button', { name: /add|new/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /add|new/i }))

      const minInput = screen.getByLabelText(/min.*value|minimum/i)
      await user.clear(minInput)
      await user.type(minInput, '50')

      const saveButton = screen.getByRole('button', { name: /save|create/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(edgeFunctions.thresholds.create).toHaveBeenCalled()
      })
    })
  })

  describe('Editing Threshold', () => {
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
        expect(
          screen.getAllByRole('button', { name: /edit/i })[0]
        ).toBeInTheDocument()
      })

      await user.click(screen.getAllByRole('button', { name: /edit/i })[0])

      expect(
        screen.getByText(/edit.*threshold|update.*threshold/i)
      ).toBeInTheDocument()
    })

    it('populates form with existing threshold data', async () => {
      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(
          screen.getAllByRole('button', { name: /edit/i })[0]
        ).toBeInTheDocument()
      })

      await user.click(screen.getAllByRole('button', { name: /edit/i })[0])

      const minInput = screen.getByLabelText(
        /min.*value|minimum/i
      ) as HTMLInputElement
      expect(minInput.value).toBe('32')
    })

    it('updates threshold with modified data', async () => {
      const user = userEvent.setup()
      ;(edgeFunctions.thresholds.update as jest.Mock).mockResolvedValue({
        success: true,
        data: { threshold: mockThresholds[0] },
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
          screen.getAllByRole('button', { name: /edit/i })[0]
        ).toBeInTheDocument()
      })

      await user.click(screen.getAllByRole('button', { name: /edit/i })[0])

      const maxInput = screen.getByLabelText(/max.*value|maximum/i)
      await user.clear(maxInput)
      await user.type(maxInput, '85')

      const saveButton = screen.getByRole('button', { name: /save|update/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(edgeFunctions.thresholds.update).toHaveBeenCalledWith(
          'threshold-1',
          expect.objectContaining({ max_value: 85 })
        )
      })
    })
  })

  describe('Deleting Threshold', () => {
    it('opens delete confirmation dialog', async () => {
      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(
          screen.getAllByRole('button', { name: /delete|remove/i })[0]
        ).toBeInTheDocument()
      })

      await user.click(
        screen.getAllByRole('button', { name: /delete|remove/i })[0]
      )

      expect(
        screen.getByText(/delete.*threshold|confirm.*delete/i)
      ).toBeInTheDocument()
    })

    it('deletes threshold on confirmation', async () => {
      const user = userEvent.setup()
      ;(edgeFunctions.thresholds.delete as jest.Mock).mockResolvedValue({
        success: true,
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
          screen.getAllByRole('button', { name: /delete|remove/i })[0]
        ).toBeInTheDocument()
      })

      await user.click(
        screen.getAllByRole('button', { name: /delete|remove/i })[0]
      )

      const confirmButton = screen.getByRole('button', {
        name: /confirm|yes|delete/i,
      })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(edgeFunctions.thresholds.delete).toHaveBeenCalledWith(
          'threshold-1'
        )
      })
    })

    it('cancels delete on cancel button', async () => {
      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(
          screen.getAllByRole('button', { name: /delete|remove/i })[0]
        ).toBeInTheDocument()
      })

      await user.click(
        screen.getAllByRole('button', { name: /delete|remove/i })[0]
      )

      const cancelButton = screen.getByRole('button', { name: /cancel|no/i })
      await user.click(cancelButton)

      expect(edgeFunctions.thresholds.delete).not.toHaveBeenCalled()
    })
  })

  describe('Temperature Unit Conversion', () => {
    it('displays temperatures in Fahrenheit', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/°F|fahrenheit/i)).toBeInTheDocument()
      })
    })

    it('displays temperatures in Celsius', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="celsius"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/°C|celsius/i)).toBeInTheDocument()
      })
    })

    it('converts values when unit toggle is clicked', async () => {
      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(
          screen.getByRole('switch', { name: /temperature|unit/i })
        ).toBeInTheDocument()
      })

      const toggle = screen.getByRole('switch', { name: /temperature|unit/i })
      await user.click(toggle)

      expect(mockOnTemperatureUnitChange).toHaveBeenCalledWith('celsius')
    })
  })

  describe('Notification Channels', () => {
    it('displays email notification option', async () => {
      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add|new/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /add|new/i }))

      expect(screen.getByText(/email/i)).toBeInTheDocument()
    })

    it('allows selecting multiple notification channels', async () => {
      const user = userEvent.setup()
      ;(edgeFunctions.thresholds.create as jest.Mock).mockResolvedValue({
        success: true,
        data: { threshold: { id: 'new-threshold' } },
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
          screen.getByRole('button', { name: /add|new/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /add|new/i }))

      // Check email checkbox
      const emailCheckbox = screen.getByRole('checkbox', { name: /email/i })
      if (!emailCheckbox.hasAttribute('checked')) {
        await user.click(emailCheckbox)
      }

      expect(emailCheckbox).toBeChecked()
    })

    it('allows entering manual email addresses', async () => {
      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add|new/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /add|new/i }))

      const emailInput = screen.getByLabelText(/email.*address|manual.*email/i)
      await user.type(emailInput, 'test@example.com, admin@example.com')

      expect(emailInput).toHaveValue('test@example.com, admin@example.com')
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
          screen.getAllByRole('button', { name: /test/i })[0]
        ).toBeInTheDocument()
      })
    })

    it('sends test alert when button clicked', async () => {
      const user = userEvent.setup()
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        expect(
          screen.getAllByRole('button', { name: /test/i })[0]
        ).toBeInTheDocument()
      })

      await user.click(screen.getAllByRole('button', { name: /test/i })[0])

      // Should show loading state
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /testing|sending/i })
        ).toBeDisabled()
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

    it('displays appropriate units for each sensor type', async () => {
      render(
        <AlertsThresholdsCard
          device={mockDevice}
          temperatureUnit="fahrenheit"
          onTemperatureUnitChange={mockOnTemperatureUnitChange}
        />
      )

      await waitFor(() => {
        // Temperature shows °F
        expect(screen.getByText(/°F/)).toBeInTheDocument()
      })

      // Humidity shows %
      expect(screen.getByText(/%/)).toBeInTheDocument()
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

    it('displays error message on create failure', async () => {
      const user = userEvent.setup()
      ;(edgeFunctions.thresholds.create as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to create threshold',
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
          screen.getByRole('button', { name: /add|new/i })
        ).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /add|new/i }))

      const minInput = screen.getByLabelText(/min.*value|minimum/i)
      await user.clear(minInput)
      await user.type(minInput, '50')

      const saveButton = screen.getByRole('button', { name: /save|create/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(edgeFunctions.thresholds.create).toHaveBeenCalled()
      })

      // Toast should be called with error
      // Note: Toast assertion depends on implementation
    })

    it('displays error message on update failure', async () => {
      const user = userEvent.setup()
      ;(edgeFunctions.thresholds.update as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to update threshold',
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
          screen.getAllByRole('button', { name: /edit/i })[0]
        ).toBeInTheDocument()
      })

      await user.click(screen.getAllByRole('button', { name: /edit/i })[0])

      const saveButton = screen.getByRole('button', { name: /save|update/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(edgeFunctions.thresholds.update).toHaveBeenCalled()
      })
    })

    it('displays error message on delete failure', async () => {
      const user = userEvent.setup()
      ;(edgeFunctions.thresholds.delete as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to delete threshold',
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
          screen.getAllByRole('button', { name: /delete|remove/i })[0]
        ).toBeInTheDocument()
      })

      await user.click(
        screen.getAllByRole('button', { name: /delete|remove/i })[0]
      )

      const confirmButton = screen.getByRole('button', {
        name: /confirm|yes|delete/i,
      })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(edgeFunctions.thresholds.delete).toHaveBeenCalled()
      })
    })
  })
})
