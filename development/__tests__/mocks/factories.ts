/**
 * Mock Data Factories
 * 
 * Factory functions to generate consistent mock data for testing.
 * Use these to create realistic test data with sensible defaults.
 */

import { format } from 'date-fns'

/**
 * Counter for generating unique IDs
 */
let counter = 1

/**
 * Generate a mock UUID
 */
export const mockUUID = (prefix: string = '00000000'): string => {
  const id = String(counter++).padStart(12, '0')
  return `${prefix}-0000-0000-0000-${id}`
}

/**
 * Generate a timestamp
 */
export const mockTimestamp = (daysAgo: number = 0): string => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString()
}

/**
 * Reset counter (call in beforeEach)
 */
export const resetMockCounter = () => {
  counter = 1
}

// ============================================================================
// USER FACTORIES
// ============================================================================

export interface MockUser {
  id: string
  email: string
  user_metadata: {
    name: string
    avatar_url?: string
  }
  app_metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

/**
 * Create a mock user
 */
export const createMockUser = (overrides: Partial<MockUser> = {}): MockUser => {
  const id = mockUUID('user')
  return {
    id,
    email: `user-${counter}@example.com`,
    user_metadata: {
      name: `Test User ${counter}`,
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
    },
    app_metadata: {},
    created_at: mockTimestamp(30),
    updated_at: mockTimestamp(0),
    ...overrides,
  }
}

/**
 * Create a mock super admin user
 */
export const createMockSuperAdmin = (overrides: Partial<MockUser> = {}): MockUser => {
  return createMockUser({
    email: 'admin@netneural.ai',
    user_metadata: { name: 'Super Admin' },
    app_metadata: { role: 'super_admin' },
    ...overrides,
  })
}

// ============================================================================
// ORGANIZATION FACTORIES
// ============================================================================

export interface MockOrganization {
  id: string
  name: string
  domain: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

/**
 * Create a mock organization
 */
export const createMockOrganization = (
  overrides: Partial<MockOrganization> = {}
): MockOrganization => {
  const orgNumber = counter
  return {
    id: mockUUID('org'),
    name: `Test Organization ${orgNumber}`,
    domain: `org${orgNumber}.example.com`,
    settings: {
      timezone: 'America/New_York',
      date_format: 'MM/DD/YYYY',
      theme: 'light',
    },
    created_at: mockTimestamp(60),
    updated_at: mockTimestamp(0),
    ...overrides,
  }
}

// ============================================================================
// DEVICE FACTORIES
// ============================================================================

export interface MockDevice {
  id: string
  organization_id: string
  name: string
  type: string
  model: string
  status: 'active' | 'inactive' | 'maintenance' | 'offline'
  last_seen: string
  battery_level: number | null
  firmware_version: string
  location_id: string | null
  integration_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

/**
 * Create a mock device
 */
export const createMockDevice = (
  overrides: Partial<MockDevice> = {}
): MockDevice => {
  const deviceNumber = counter
  return {
    id: mockUUID('device'),
    organization_id: mockUUID('org'),
    name: `Device ${deviceNumber}`,
    type: 'sensor',
    model: 'TH-100',
    status: 'active',
    last_seen: mockTimestamp(0),
    battery_level: 85,
    firmware_version: '1.2.3',
    location_id: mockUUID('location'),
    integration_id: mockUUID('integration'),
    metadata: {
      manufacturer: 'ACME Corp',
      serial_number: `SN-${deviceNumber.toString().padStart(8, '0')}`,
    },
    created_at: mockTimestamp(30),
    updated_at: mockTimestamp(0),
    ...overrides,
  }
}

/**
 * Create multiple mock devices
 */
export const createMockDevices = (count: number): MockDevice[] => {
  return Array.from({ length: count }, () => createMockDevice())
}

// ============================================================================
// ALERT FACTORIES
// ============================================================================

export interface MockAlert {
  id: string
  organization_id: string
  device_id: string
  rule_id: string | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'active' | 'acknowledged' | 'resolved'
  message: string
  details: Record<string, unknown>
  triggered_at: string
  acknowledged_at: string | null
  acknowledged_by: string | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Create a mock alert
 */
export const createMockAlert = (
  overrides: Partial<MockAlert> = {}
): MockAlert => {
  const alertNumber = counter
  const severity = overrides.severity || 'medium'
  
  return {
    id: mockUUID('alert'),
    organization_id: mockUUID('org'),
    device_id: mockUUID('device'),
    rule_id: mockUUID('rule'),
    severity,
    status: 'active',
    message: `${severity.toUpperCase()}: Sensor threshold exceeded`,
    details: {
      sensor_type: 'temperature',
      current_value: 85.5,
      threshold: 80.0,
      unit: '°F',
    },
    triggered_at: mockTimestamp(0),
    acknowledged_at: null,
    acknowledged_by: null,
    resolved_at: null,
    resolved_by: null,
    created_at: mockTimestamp(0),
    updated_at: mockTimestamp(0),
    ...overrides,
  }
}

/**
 * Create an acknowledged alert
 */
export const createMockAcknowledgedAlert = (
  overrides: Partial<MockAlert> = {}
): MockAlert => {
  return createMockAlert({
    status: 'acknowledged',
    acknowledged_at: mockTimestamp(0),
    acknowledged_by: mockUUID('user'),
    ...overrides,
  })
}

/**
 * Create a resolved alert
 */
export const createMockResolvedAlert = (
  overrides: Partial<MockAlert> = {}
): MockAlert => {
  return createMockAlert({
    status: 'resolved',
    acknowledged_at: mockTimestamp(1),
    acknowledged_by: mockUUID('user'),
    resolved_at: mockTimestamp(0),
    resolved_by: mockUUID('user'),
    ...overrides,
  })
}

/**
 * Create multiple mock alerts
 */
export const createMockAlerts = (count: number): MockAlert[] => {
  return Array.from({ length: count }, () => createMockAlert())
}

// ============================================================================
// TELEMETRY DATA FACTORIES
// ============================================================================

export interface MockTelemetryData {
  id: string
  device_id: string
  timestamp: string
  sensor_type: string
  value: number
  unit: string
  metadata: Record<string, unknown>
}

/**
 * Create mock telemetry data
 */
export const createMockTelemetryData = (
  overrides: Partial<MockTelemetryData> = {}
): MockTelemetryData => {
  return {
    id: mockUUID('telemetry'),
    device_id: mockUUID('device'),
    timestamp: mockTimestamp(0),
    sensor_type: 'temperature',
    value: 72.5,
    unit: '°F',
    metadata: {
      accuracy: 0.5,
      confidence: 0.95,
    },
    ...overrides,
  }
}

/**
 * Create a time series of telemetry data
 */
export const createMockTelemetrySeries = (
  count: number,
  hoursApart: number = 1
): MockTelemetryData[] => {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date()
    date.setHours(date.getHours() - (index * hoursApart))
    
    return createMockTelemetryData({
      timestamp: date.toISOString(),
      value: 70 + Math.random() * 10, // Random value between 70-80
    })
  }).reverse() // Oldest first
}

// ============================================================================
// INTEGRATION FACTORIES
// ============================================================================

export interface MockIntegration {
  id: string
  organization_id: string
  name: string
  type: 'golioth' | 'aws_iot' | 'azure_iot' | 'mqtt' | 'webhook'
  status: 'active' | 'inactive' | 'error'
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

/**
 * Create a mock integration
 */
export const createMockIntegration = (
  overrides: Partial<MockIntegration> = {}
): MockIntegration => {
  const integrationNumber = counter
  return {
    id: mockUUID('integration'),
    organization_id: mockUUID('org'),
    name: `Integration ${integrationNumber}`,
    type: 'golioth',
    status: 'active',
    config: {
      api_key: 'mock-api-key',
      project_id: 'mock-project',
    },
    created_at: mockTimestamp(30),
    updated_at: mockTimestamp(0),
    ...overrides,
  }
}

// ============================================================================
// LOCATION FACTORIES
// ============================================================================

export interface MockLocation {
  id: string
  organization_id: string
  name: string
  address: string
  city: string
  state: string
  country: string
  postal_code: string
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

/**
 * Create a mock location
 */
export const createMockLocation = (
  overrides: Partial<MockLocation> = {}
): MockLocation => {
  const locationNumber = counter
  return {
    id: mockUUID('location'),
    organization_id: mockUUID('org'),
    name: `Facility ${locationNumber}`,
    address: `${locationNumber}00 Main St`,
    city: 'Boston',
    state: 'MA',
    country: 'USA',
    postal_code: '02101',
    latitude: 42.3601 + (Math.random() - 0.5) * 0.1,
    longitude: -71.0589 + (Math.random() - 0.5) * 0.1,
    created_at: mockTimestamp(60),
    updated_at: mockTimestamp(0),
    ...overrides,
  }
}

export default {
  createMockUser,
  createMockSuperAdmin,
  createMockOrganization,
  createMockDevice,
  createMockDevices,
  createMockAlert,
  createMockAcknowledgedAlert,
  createMockResolvedAlert,
  createMockAlerts,
  createMockTelemetryData,
  createMockTelemetrySeries,
  createMockIntegration,
  createMockLocation,
  mockUUID,
  mockTimestamp,
  resetMockCounter,
}
