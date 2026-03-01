/**
 * Base Integration Provider Interface
 * ==================================
 * Common abstraction for all IoT platform integrations (Golioth, AWS IoT, Azure IoT, etc.)
 *
 * This interface ensures consistent behavior across all providers and enables:
 * - Multi-provider support without code duplication
 * - Easy addition of new IoT platforms
 * - Provider-agnostic frontend and sync services
 *
 * Date: 2025-11-09
 * Issue: #82 - Common Integration Provider Interface
 */

// ============================================================================
// Core Types
// ============================================================================

export interface PaginationOptions {
  page?: number
  limit?: number
  offset?: number
}

export interface DeviceListResult {
  devices: DeviceData[]
  total: number
  page: number
  limit: number
}

export interface ConnectionInfo {
  state: 'online' | 'offline' | 'unknown'
  lastActivity: Date
  uptime?: number // seconds
  quality?: number // 0-100
}

export interface FirmwareInfo {
  version: string
  updateAvailable: boolean
  components?: Array<{
    name: string
    version: string
    state?: string
  }>
}

export interface DeviceStatus {
  connectionState: 'online' | 'offline' | 'unknown'
  lastActivity: Date
  uptime?: number
  firmware?: FirmwareInfo
  telemetry: Record<string, unknown>
  health?: {
    battery?: number
    signalStrength?: number
    temperature?: number
  }
}

export interface DeviceData {
  id: string
  name: string
  externalId: string
  status: 'online' | 'offline' | 'unknown'
  deviceType?: string // Device type/category
  model?: string // Device model
  serialNumber?: string // Serial number
  firmwareVersion?: string // Firmware version
  hardwareIds?: string[] // Hardware identifiers
  cohortId?: string // OTA update group/cohort
  parentDeviceId?: string // Parent/gateway device ID for hierarchical relationships
  isGateway?: boolean // Is this device a gateway for other devices?
  tags?: string[] // Tags for categorization
  metadata?: Record<string, unknown> // Additional metadata
  batteryLevel?: number // Battery percentage (0-100)
  signalStrength?: number // Signal strength (dBm or percentage)
  lastSeen?: Date // Last activity timestamp
  lastSeenOnline?: Date // Last seen online timestamp
  lastSeenOffline?: Date // Last seen offline timestamp
  createdAt: Date // Creation timestamp
  updatedAt: Date // Last update timestamp
}

export interface DeviceUpdate {
  name?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface TelemetryQuery {
  deviceId: string
  startTime?: Date
  endTime?: Date
  metrics?: string[]
  limit?: number
}

export interface TelemetryData {
  deviceId: string
  timestamp: Date
  metrics: Record<string, unknown>
  path?: string
}

export interface TestConnectionResult {
  success: boolean
  message: string
  latency?: number
  details?: Record<string, unknown>
}

// ============================================================================
// Base Integration Provider (Abstract Class)
// ============================================================================

export abstract class DeviceIntegrationProvider {
  /**
   * Unique identifier for this provider instance
   */
  abstract providerId: string

  /**
   * Type of provider (golioth, aws-iot, azure-iot, mqtt, netneural-hub, etc.)
   */
  abstract providerType: string

  /**
   * Display name for this provider
   */
  abstract providerName: string

  /**
   * Test connection to the provider
   */
  abstract testConnection(): Promise<TestConnectionResult>

  /**
   * List all devices from the provider
   */
  abstract listDevices(options?: PaginationOptions): Promise<DeviceListResult>

  /**
   * Get a specific device by ID
   */
  abstract getDevice(deviceId: string): Promise<DeviceData>

  /**
   * Get real-time device status
   */
  abstract getDeviceStatus(deviceId: string): Promise<DeviceStatus>

  /**
   * Update device information
   */
  abstract updateDevice(
    deviceId: string,
    updates: DeviceUpdate
  ): Promise<DeviceData>

  /**
   * Query telemetry data
   */
  abstract queryTelemetry(query: TelemetryQuery): Promise<TelemetryData[]>

  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return {
      supportsRealTimeStatus: true,
      supportsTelemetry: true,
      supportsFirmwareManagement: false,
      supportsRemoteCommands: false,
      supportsBidirectionalSync: false,
    }
  }
}

export interface ProviderCapabilities {
  supportsRealTimeStatus: boolean
  supportsTelemetry: boolean
  supportsFirmwareManagement: boolean
  supportsRemoteCommands: boolean
  supportsBidirectionalSync: boolean
}

// ============================================================================
// Provider Configuration
// ============================================================================

export interface ProviderConfig {
  type: string
  apiKey?: string
  projectId?: string
  region?: string
  endpoint?: string
  credentials?: Record<string, unknown>
}
