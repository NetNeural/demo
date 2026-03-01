/**
 * Azure IoT Hub Integration Provider
 * ===================================
 * Integrates with Azure IoT Hub for device management, status tracking, and telemetry.
 *
 * Azure IoT Hub uses a Device Registry for device management and Device Twins for device state.
 *
 * Capabilities:
 * - Real-time device status via Device Twins
 * - Device metadata management via Device Twin tags and properties
 * - Remote commands via Device Twin desired properties and direct methods
 * - Firmware updates via Device Twin properties
 * - Built-in telemetry with configurable routing
 *
 * Azure IoT Concepts:
 * - Device Identity: Device registration in IoT Hub
 * - Device Twin: JSON document storing device state, tags, and properties
 * - Direct Methods: Synchronous request/response communication
 * - Cloud-to-Device Messages: Asynchronous one-way messages
 *
 * Date: 2025-11-09
 * Issue: #82 - Complete Integration Provider Implementation
 */

// Azure IoT SDK imports
import { Registry } from 'azure-iothub'

import {
  DeviceIntegrationProvider,
  DeviceData,
  DeviceStatus,
  DeviceListResult,
  TestConnectionResult,
  TelemetryQuery,
  TelemetryData,
  DeviceUpdate,
  ProviderCapabilities,
  PaginationOptions,
  ProviderConfig,
} from './base-integration-provider'
import { FrontendActivityLogger } from '@/lib/monitoring/activity-logger'

// ============================================================================
// Azure IoT Types
// ============================================================================

interface AzureIotConfig {
  connectionString: string
  hubName?: string
}

interface AzureDevice {
  deviceId: string
  generationId?: string
  etag?: string
  connectionState?: string
  status?: string
  statusReason?: string
  connectionStateUpdatedTime?: string
  statusUpdatedTime?: string
  lastActivityTime?: string
  cloudToDeviceMessageCount?: number
  authentication?: {
    symmetricKey?: {
      primaryKey?: string
      secondaryKey?: string
    }
    x509Thumbprint?: {
      primaryThumbprint?: string
      secondaryThumbprint?: string
    }
  }
}

interface AzureTwin {
  deviceId: string
  etag?: string
  version?: number
  tags?: Record<string, unknown>
  properties?: {
    desired?: Record<string, unknown>
    reported?: Record<string, unknown>
  }
  status?: string
  connectionState?: string
  lastActivityTime?: Date
}

// ============================================================================
// Azure IoT Hub Integration Provider
// ============================================================================

export class AzureIotIntegrationProvider extends DeviceIntegrationProvider {
  override providerId: string
  override providerType = 'azure_iot'
  override providerName = 'Azure IoT Hub'

  private registry: Registry
  private hubName: string
  private activityLogger: FrontendActivityLogger
  private organizationId: string
  private integrationId: string

  constructor(config: ProviderConfig) {
    super()

    // Extract Azure-specific config from generic ProviderConfig
    const connectionString =
      (config.credentials?.connectionString as string) || ''
    const hubName = (config.credentials?.hubName as string) || ''
    const providerId =
      (config.credentials?.integrationId as string) ||
      config.projectId ||
      'azure-iot'
    const organizationId = (config.credentials?.organizationId as string) || ''

    this.providerId = providerId
    this.integrationId = providerId
    this.organizationId = organizationId
    this.activityLogger = new FrontendActivityLogger()
    this.registry = Registry.fromConnectionString(connectionString)

    // Extract hub name from connection string if not provided
    const hubNameMatch = connectionString.match(/HostName=([^.]+)\./)
    this.hubName = hubName || (hubNameMatch ? hubNameMatch[1] : '') || 'unknown'
  }

  /**
   * Test connection to Azure IoT Hub
   */
  override async testConnection(): Promise<TestConnectionResult> {
    if (!this.organizationId || !this.integrationId) {
      return this._testConnectionInternal()
    }

    return this.activityLogger.withLog(
      {
        organizationId: this.organizationId,
        integrationId: this.integrationId,
        direction: 'outgoing',
        activityType: 'test_connection',
        endpoint: `Azure IoT Hub: ${this.hubName}`,
      },
      async () => {
        return this._testConnectionInternal()
      }
    )
  }

  private async _testConnectionInternal(): Promise<TestConnectionResult> {
    try {
      // Try to list devices (limit 1) to verify connection
      await this.registry.list()

      return {
        success: true,
        message: `Successfully connected to Azure IoT Hub: ${this.hubName}`,
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  /**
   * List devices from Azure IoT Hub using IoT Hub query language.
   * Uses registry.createQuery() for server-side pagination instead of
   * fetching all devices into memory.
   */
  override async listDevices(
    options?: PaginationOptions
  ): Promise<DeviceListResult> {
    try {
      const limit = options?.limit || 100
      const page = options?.page || 0

      // Use IoT Hub query language with server-side pagination
      // This avoids loading ALL devices into memory (the previous approach)
      const query = this.registry.createQuery(
        'SELECT * FROM devices',
        limit
      )

      // Skip pages by consuming continuation tokens
      let currentPage = 0
      let queryResult: { result: AzureDevice[]; hasMoreResults: boolean } | null = null
      while (query.hasMoreResults && currentPage <= page) {
        const response = await query.next()
        queryResult = response as unknown as { result: AzureDevice[]; hasMoreResults: boolean }
        currentPage++
      }

      const azureDevices = queryResult?.result || []

      // Map Azure devices to generic format
      const devices: DeviceData[] = await Promise.all(
        azureDevices.map(async (device) => this.mapDeviceToGeneric(device))
      )

      return {
        devices,
        total: devices.length, // Exact total unknown with cursor pagination
        page,
        limit,
      }
    } catch {
      return {
        devices: [],
        total: 0,
        page: options?.page || 0,
        limit: options?.limit || 100,
      }
    }
  }

  /**
   * Get a specific device from Azure IoT Hub
   */
  override async getDevice(deviceId: string): Promise<DeviceData> {
    try {
      const result = await this.registry.get(deviceId)
      const device = result.responseBody as AzureDevice
      return this.mapDeviceToGeneric(device)
    } catch (err) {
      throw new Error(
        `Device ${deviceId} not found: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get device status from Device Twin
   */
  override async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    try {
      const result = await this.registry.getTwin(deviceId)
      const twin = result.responseBody as AzureTwin
      return this.mapTwinToStatus(twin)
    } catch (err) {
      throw new Error(
        `Failed to get status for device ${deviceId}: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Update device metadata
   */
  override async updateDevice(
    deviceId: string,
    updates: DeviceUpdate
  ): Promise<DeviceData> {
    try {
      // Get current twin
      const twinResult = await this.registry.getTwin(deviceId)
      const twin = twinResult.responseBody as AzureTwin

      // Update tags (for name, tags, metadata)
      const patch = {
        tags: {
          ...(twin.tags || {}),
          name: updates.name,
          customTags: updates.tags,
          metadata: updates.metadata,
        },
      }

      // Apply patch
      await this.registry.updateTwin(deviceId, patch, twin.etag || '*')

      // Return updated device
      return this.getDevice(deviceId)
    } catch (err) {
      throw new Error(
        `Failed to update device ${deviceId}: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Query telemetry data.
   *
   * Azure IoT Hub does not store telemetry history natively.
   * Device-to-cloud messages are transient and routed via endpoints.
   * Historical telemetry requires one of:
   *  - Azure IoT Central (managed app with built-in telemetry storage)
   *  - Azure Time Series Insights / Data Explorer
   *  - Azure Event Hubs → Stream Analytics → storage
   *  - Custom routing rules to Blob Storage / Cosmos DB
   *
   * Current device state IS available via Device Twins (see getDeviceStatus).
   * Returns empty array to signal "not supported" without throwing.
   */
  override async queryTelemetry(): Promise<TelemetryData[]> {
    return []
  }

  /**
   * Get provider capabilities
   */
  override getCapabilities(): ProviderCapabilities {
    return {
      supportsRealTimeStatus: true, // Via Device Twin
      supportsTelemetry: false, // Requires additional services
      supportsFirmwareManagement: true, // Via Device Twin properties
      supportsRemoteCommands: true, // Via direct methods and desired properties
      supportsBidirectionalSync: true, // Can read and write
    }
  }

  /**
   * Map Azure Device to generic DeviceData
   */
  private async mapDeviceToGeneric(device: AzureDevice): Promise<DeviceData> {
    // Try to get twin for additional info
    let twin: AzureTwin | null = null
    try {
      const result = await this.registry.getTwin(device.deviceId)
      twin = result.responseBody as AzureTwin
    } catch {
      // Twin doesn't exist or error - continue without it
    }

    // Determine status
    const status =
      device.connectionState === 'Connected'
        ? 'online'
        : device.connectionState === 'Disconnected'
          ? 'offline'
          : 'unknown'

    // Get last activity
    const lastSeen = device.lastActivityTime
      ? new Date(device.lastActivityTime)
      : undefined

    return {
      id: device.deviceId,
      name: (twin?.tags?.['name'] as string) || device.deviceId,
      externalId: device.deviceId,
      status: status as 'online' | 'offline' | 'unknown',
      hardwareIds: (twin?.tags?.['hardwareIds'] as string[]) || undefined,
      tags: (twin?.tags?.['customTags'] as string[]) || undefined,
      metadata: {
        generationId: device.generationId,
        etag: device.etag,
        status: device.status,
        statusReason: device.statusReason,
        cloudToDeviceMessageCount: device.cloudToDeviceMessageCount,
        twinTags: twin?.tags,
        twinProperties: twin?.properties,
      },
      lastSeen: lastSeen,
      createdAt: device.statusUpdatedTime
        ? new Date(device.statusUpdatedTime)
        : new Date(),
      updatedAt: device.connectionStateUpdatedTime
        ? new Date(device.connectionStateUpdatedTime)
        : new Date(),
    }
  }

  /**
   * Map Azure Device Twin to generic DeviceStatus
   */
  private mapTwinToStatus(twin: AzureTwin): DeviceStatus {
    const reported = twin.properties?.reported || {}
    const desired = twin.properties?.desired || {}

    // Determine connection state
    const connectionState =
      twin.connectionState === 'Connected'
        ? 'online'
        : twin.connectionState === 'Disconnected'
          ? 'offline'
          : 'unknown'

    // Get last activity
    const lastActivity = twin.lastActivityTime || new Date()

    // Extract firmware info from reported properties
    const firmwareVersion =
      (reported['$version'] as string) ||
      (reported['firmwareVersion'] as string) ||
      'unknown'
    const firmwareUpdateAvailable =
      !!desired['firmwareVersion'] &&
      desired['firmwareVersion'] !== reported['firmwareVersion']

    // Extract health metrics from reported properties
    const battery = reported['battery'] as number
    const signalStrength =
      (reported['signalStrength'] as number) || (reported['rssi'] as number)
    const temperature = reported['temperature'] as number

    return {
      connectionState: connectionState as 'online' | 'offline' | 'unknown',
      lastActivity,
      uptime: reported['uptime'] as number,
      firmware: {
        version: firmwareVersion,
        updateAvailable: firmwareUpdateAvailable,
      },
      telemetry: reported,
      health: {
        battery,
        signalStrength,
        temperature,
      },
    }
  }
}
