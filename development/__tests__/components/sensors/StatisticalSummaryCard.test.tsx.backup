/**
 * Unit Tests for StatisticalSummaryCard Component
 * 
 * Tests coverage:
 * - Rendering AI analysis
 * - Temperature unit toggle (Celsius/Fahrenheit)
 * - Loading states
 * - Sensor data statistics (avg, min, max)
 * - Trend analysis (rising, falling, stable)
 * - AI insights generation
 * - Location-based context
 * - Multiple sensor types
 * - Empty states
 * - Error handling
 */

import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { StatisticalSummaryCard } from '@/components/sensors/StatisticalSummaryCard'
import { createMockDevice, createMockTelemetrySeries } from '../../mocks/factories'

describe('StatisticalSummaryCard Component', () => {
  const mockDevice = createMockDevice({
    name: 'Temperature Sensor A',
    location_id: 'loc-1',
  })

  const mockTelemetryReadings = [
    {
      telemetry: { value: 72, type: 1, sensor: 'temperature' },
      device_timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      received_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
    {
      telemetry: { value: 73, type: 1, sensor: 'temperature' },
      device_timestamp: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      received_at: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    },
    {
      telemetry: { value: 74, type: 1, sensor: 'temperature' },
      device_timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      received_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    },
    {
      telemetry: { value: 75, type: 1, sensor: 'temperature' },
      device_timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      received_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      telemetry: { value: 76, type: 1, sensor: 'temperature' },
      device_timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      received_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    },
  ]

  describe('Rendering and AI Analysis', () => {
    it('renders statistical summary card', () => {
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(screen.getByText(/statistical summary/i)).toBeInTheDocument()
    })

    it('displays AI analysis header', () => {
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(screen.getByText(/ai analysis/i)).toBeInTheDocument()
    })

    it('shows AI Brain icon', () => {
      const { container } = render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(container.querySelector('[data-lucide="brain"]')).toBeInTheDocument()
    })

    it('displays sensor analysis', () => {
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(screen.getByText(/temperature/i)).toBeInTheDocument()
    })
  })

  describe('Temperature Unit Toggle', () => {
    it('displays temperature in Fahrenheit', () => {
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      // Average of 72-76°F
      expect(screen.getByText(/74.*°F/)).toBeInTheDocument()
    })

    it('displays temperature in Celsius', () => {
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="celsius"
        />
      )
      
      // Should convert from F to C
      expect(screen.getByText(/°C/)).toBeInTheDocument()
    })

    it('instantly updates when unit changes', () => {
      const { rerender } = render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(screen.getByText(/°F/)).toBeInTheDocument()
      
      rerender(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="celsius"
        />
      )
      
      expect(screen.getByText(/°C/)).toBeInTheDocument()
    })

    it('converts all temperature values when unit changes', () => {
      const { rerender } = render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      // Check for Fahrenheit values
      expect(screen.getByText(/avg.*74.*°F/i)).toBeInTheDocument()
      
      rerender(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="celsius"
        />
      )
      
      // All values should now be in Celsius
      expect(screen.queryByText(/°F/)).not.toBeInTheDocument()
      expect(screen.getByText(/°C/)).toBeInTheDocument()
    })
  })

  describe('Sensor Statistics', () => {
    it('calculates and displays average value', () => {
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      // Average of 72, 73, 74, 75, 76 = 74
      expect(screen.getByText(/avg.*74/i)).toBeInTheDocument()
    })

    it('displays minimum value', () => {
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(screen.getByText(/min.*72/i)).toBeInTheDocument()
    })

    it('displays maximum value', () => {
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(screen.getByText(/max.*76/i)).toBeInTheDocument()
    })

    it('displays reading count', () => {
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(screen.getByText(/5.*readings/i)).toBeInTheDocument()
    })
  })

  describe('Trend Analysis', () => {
    it('detects rising trend', () => {
      const risingReadings = [
        { telemetry: { value: 70, type: 1 }, device_timestamp: new Date(Date.now() - 50 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 72, type: 1 }, device_timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 74, type: 1 }, device_timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 76, type: 1 }, device_timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 78, type: 1 }, device_timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
      ]
      
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={risingReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(screen.getByText(/rising/i)).toBeInTheDocument()
    })

    it('detects falling trend', () => {
      const fallingReadings = [
        { telemetry: { value: 78, type: 1 }, device_timestamp: new Date(Date.now() - 50 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 76, type: 1 }, device_timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 74, type: 1 }, device_timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 72, type: 1 }, device_timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 70, type: 1 }, device_timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
      ]
      
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={fallingReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(screen.getByText(/falling/i)).toBeInTheDocument()
    })

    it('detects stable trend', () => {
      const stableReadings = [
        { telemetry: { value: 72, type: 1 }, device_timestamp: new Date(Date.now() - 50 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 72.5, type: 1 }, device_timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 72, type: 1 }, device_timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 72.2, type: 1 }, device_timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 72, type: 1 }, device_timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
      ]
      
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={stableReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(screen.getByText(/stable/i)).toBeInTheDocument()
    })

    it('displays trend percentage', () => {
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      // Should show percentage change
      expect(screen.getByText(/%/)).toBeInTheDocument()
    })
  })

  describe('AI Insights', () => {
    it('generates normal condition insight', () => {
      const normalReadings = [
        { telemetry: { value: 70, type: 1 }, device_timestamp: new Date().toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 71, type: 1 }, device_timestamp: new Date().toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 70, type: 1 }, device_timestamp: new Date().toISOString(), received_at: new Date().toISOString() },
      ]
      
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={normalReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(screen.getByText(/normal/i)).toBeInTheDocument()
    })

    it('generates warning insight for trend', () => {
      const warningReadings = [
        { telemetry: { value: 70, type: 1 }, device_timestamp: new Date(Date.now() - 50 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 74, type: 1 }, device_timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 78, type: 1 }, device_timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 82, type: 1 }, device_timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 86, type: 1 }, device_timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), received_at: new Date().toISOString() },
      ]
      
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={warningReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(screen.getByText(/warning|alert|concern/i)).toBeInTheDocument()
    })

    it('displays insight icons', () => {
      const { container } = render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      // Should have insight indicator icons
      expect(container.querySelector('[data-lucide="check-circle"]') || 
             container.querySelector('[data-lucide="alert-circle"]')).toBeInTheDocument()
    })
  })

  describe('Multiple Sensor Types', () => {
    it('analyzes multiple sensor types', () => {
      const multiSensorReadings = [
        { telemetry: { value: 72, type: 1 }, device_timestamp: new Date().toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 65, type: 2 }, device_timestamp: new Date().toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 1013, type: 3 }, device_timestamp: new Date().toISOString(), received_at: new Date().toISOString() },
      ]
      
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={multiSensorReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(screen.getByText(/temperature/i)).toBeInTheDocument()
      expect(screen.getByText(/humidity/i)).toBeInTheDocument()
    })

    it('displays correct icons for each sensor type', () => {
      const multiSensorReadings = [
        { telemetry: { value: 72, type: 1 }, device_timestamp: new Date().toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 65, type: 2 }, device_timestamp: new Date().toISOString(), received_at: new Date().toISOString() },
      ]
      
      const { container } = render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={multiSensorReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(container.querySelector('[data-lucide="thermometer"]')).toBeInTheDocument()
      expect(container.querySelector('[data-lucide="droplets"]')).toBeInTheDocument()
    })
  })

  describe('Loading and Empty States', () => {
    it('handles empty telemetry gracefully', () => {
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={[]}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(screen.getByText(/no data|insufficient data/i)).toBeInTheDocument()
    })

    it('displays message for insufficient data', () => {
      const insufficientReadings = [
        { telemetry: { value: 72, type: 1 }, device_timestamp: new Date().toISOString(), received_at: new Date().toISOString() },
      ]
      
      render(
        <StatisticalSummaryCard
          device={mockDevice}
          telemetryReadings={insufficientReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      // Should indicate need for more data or show limited analysis
      expect(screen.getByText(/1.*reading|limited data/i)).toBeInTheDocument()
    })

    it('handles missing device gracefully', () => {
      render(
        <StatisticalSummaryCard
          device={null as any}
          telemetryReadings={mockTelemetryReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      // Should not crash, may show error or empty state
      expect(screen.getByText(/statistical summary|no device/i)).toBeInTheDocument()
    })
  })

  describe('Location Context', () => {
    it('provides context-aware analysis for cooler location', () => {
      const coolerDevice = createMockDevice({
        name: 'Walk-in Cooler Sensor',
        location_id: 'cooler-1',
      })
      
      const coolerReadings = [
        { telemetry: { value: 38, type: 1 }, device_timestamp: new Date().toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 39, type: 1 }, device_timestamp: new Date().toISOString(), received_at: new Date().toISOString() },
      ]
      
      render(
        <StatisticalSummaryCard
          device={coolerDevice}
          telemetryReadings={coolerReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      // Should recognize cooler context and provide appropriate insights
      expect(screen.getByText(/temperature/i)).toBeInTheDocument()
    })

    it('provides context-aware analysis for kitchen location', () => {
      const kitchenDevice = createMockDevice({
        name: 'Kitchen Sensor',
        location_id: 'kitchen-1',
      })
      
      const kitchenReadings = [
        { telemetry: { value: 70, type: 1 }, device_timestamp: new Date().toISOString(), received_at: new Date().toISOString() },
        { telemetry: { value: 71, type: 1 }, device_timestamp: new Date().toISOString(), received_at: new Date().toISOString() },
      ]
      
      render(
        <StatisticalSummaryCard
          device={kitchenDevice}
          telemetryReadings={kitchenReadings}
          temperatureUnit="fahrenheit"
        />
      )
      
      expect(screen.getByText(/temperature/i)).toBeInTheDocument()
    })
  })
})
