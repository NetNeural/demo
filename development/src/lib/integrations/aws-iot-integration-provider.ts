/**
 * AWS IoT Core Integration Provider
 *
 * Implements DeviceIntegrationProvider for AWS IoT Core.
 * Provides device management, status monitoring, and shadow access.
 *
 * AWS IoT Concepts:
 * - Thing: Physical or logical device
 * - Shadow: JSON document storing device state
 * - Thing Type: Template for device metadata
 * - Thing Group: Collection of related devices
 */

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

// AWS SDK v3 imports
import {
  IoTClient,
  ListThingsCommand,
  DescribeThingCommand,
  UpdateThingCommand,
} from '@aws-sdk/client-iot'
import {
  IoTDataPlaneClient,
  GetThingShadowCommand,
} from '@aws-sdk/client-iot-data-plane'

// Type for AWS IoT Thing
interface AwsThing {
  thingName?: string
  thingTypeName?: string
  attributes?: Record<string, string>
  version?: number
}

// Type for AWS IoT Shadow
interface AwsShadow {
  state?: {
    reported?: Record<string, unknown>
    desired?: Record<string, unknown>
  }
  metadata?: {
    reported?: Record<string, { timestamp: number }>
    desired?: Record<string, { timestamp: number }>
  }
  version?: number
  timestamp?: number
}

export interface AwsIotConfig {
  region: string
  accessKeyId: string
  secretAccessKey: string
  endpoint?: string // Custom IoT endpoint (optional)
}

export class AwsIotIntegrationProvider extends DeviceIntegrationProvider {
  override providerId: string
  override providerType = 'aws_iot'
  override providerName = 'AWS IoT Core'

  private iotClient: IoTClient
  private iotDataClient: IoTDataPlaneClient
  private region: string
  private activityLogger: FrontendActivityLogger
  private organizationId: string
  private integrationId: string

  constructor(config: ProviderConfig) {
    super()

    // Extract AWS-specific config from generic ProviderConfig
    const region =
      config.region || (config.credentials?.region as string) || 'us-east-1'
    const accessKeyId = (config.credentials?.accessKeyId as string) || ''
    const secretAccessKey =
      (config.credentials?.secretAccessKey as string) || ''
    const endpoint = config.endpoint
    const integrationId =
      (config.credentials?.integrationId as string) ||
      config.projectId ||
      'aws-iot'
    const organizationId = (config.credentials?.organizationId as string) || ''

    this.providerId = integrationId
    this.integrationId = integrationId
    this.organizationId = organizationId
    this.activityLogger = new FrontendActivityLogger()
    this.region = region

    // Initialize AWS IoT Control Plane client
    this.iotClient = new IoTClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })

    // Initialize AWS IoT Data Plane client
    const dataPlaneConfig: {
      region: string
      credentials: { accessKeyId: string; secretAccessKey: string }
      endpoint?: string
    } = {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }

    if (endpoint) {
      dataPlaneConfig.endpoint = endpoint
    }

    this.iotDataClient = new IoTDataPlaneClient(dataPlaneConfig)
  }

  /**
   * Test AWS IoT connection
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
        endpoint: `AWS IoT Core (${this.region})`,
      },
      async () => {
        return this._testConnectionInternal()
      }
    )
  }

  private async _testConnectionInternal(): Promise<TestConnectionResult> {
    try {
      // Try to list things (limited to 1 for quick test)
      const command = new ListThingsCommand({ maxResults: 1 })
      await this.iotClient.send(command)

      return {
        success: true,
        message: 'Successfully connected to AWS IoT Core',
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  /**
   * List all IoT Things
   */
  override async listDevices(
    options?: PaginationOptions
  ): Promise<DeviceListResult> {
    try {
      const things: AwsThing[] = []
      let nextToken: string | undefined

      // AWS IoT uses pagination
      do {
        const command = new ListThingsCommand({
          maxResults: options?.limit || 250, // AWS max is 250
          nextToken: nextToken,
        })

        const response = await this.iotClient.send(command)

        if (response.things) {
          things.push(...response.things)
        }

        nextToken = response.nextToken

        // If limit specified, stop when we have enough
        if (options?.limit && things.length >= options.limit) {
          break
        }
      } while (nextToken)

      // Map AWS Things to generic DeviceData
      const devices: DeviceData[] = await Promise.all(
        things.map(async (thing) => this.mapThingToDevice(thing))
      )

      return {
        devices: devices,
        total: devices.length,
        page: options?.page || 0,
        limit: options?.limit || 100,
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
   * Get single device details
   */
  override async getDevice(deviceId: string): Promise<DeviceData> {
    try {
      const command = new DescribeThingCommand({ thingName: deviceId })
      const response = await this.iotClient.send(command)

      return this.mapThingToDevice({
        thingName: response.thingName,
        thingTypeName: response.thingTypeName,
        attributes: response.attributes,
        version: response.version,
      })
    } catch (error) {
      throw new Error(
        `Failed to get AWS IoT device: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get device status from Thing Shadow
   */
  override async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    try {
      const command = new GetThingShadowCommand({ thingName: deviceId })
      const response = await this.iotDataClient.send(command)

      if (!response.payload) {
        throw new Error('No shadow data returned')
      }

      // Parse shadow JSON
      const shadowString = new TextDecoder().decode(response.payload)
      const shadow: AwsShadow = JSON.parse(shadowString)

      return this.mapShadowToStatus(shadow)
    } catch (error) {
      // If shadow doesn't exist or error, return unknown status
      return {
        connectionState: 'unknown',
        lastActivity: new Date(),
        telemetry: {},
      }
    }
  }

  /**
   * Update device (thing attributes)
   */
  override async updateDevice(
    deviceId: string,
    updates: DeviceUpdate
  ): Promise<DeviceData> {
    try {
      const command = new UpdateThingCommand({
        thingName: deviceId,
        attributePayload: {
          attributes: updates.metadata as Record<string, string> | undefined,
        },
      })

      await this.iotClient.send(command)

      // Return updated device
      return await this.getDevice(deviceId)
    } catch (error) {
      throw new Error(
        `Failed to update AWS IoT device: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Query telemetry (from shadow history - limited in AWS IoT)
   * AWS IoT doesn't provide built-in telemetry history
   * This would require integration with AWS IoT Analytics or custom storage
   */
  override async queryTelemetry(): Promise<TelemetryData[]> {
    return []
  }

  /**
   * Get provider capabilities
   */
  override getCapabilities(): ProviderCapabilities {
    return {
      supportsRealTimeStatus: true, // Via shadows
      supportsTelemetry: false, // Requires IoT Analytics integration
      supportsFirmwareManagement: true, // Via jobs
      supportsRemoteCommands: true, // Via shadows/jobs
      supportsBidirectionalSync: true, // Can read and write
    }
  }

  /**
   * Map AWS Thing to generic DeviceData
   */
  private async mapThingToDevice(thing: AwsThing): Promise<DeviceData> {
    const thingName = thing.thingName || 'unknown'

    // Try to get shadow for additional info
    let shadow: AwsShadow | null = null
    try {
      const command = new GetThingShadowCommand({ thingName })
      const response = await this.iotDataClient.send(command)
      if (response.payload) {
        const shadowString = new TextDecoder().decode(response.payload)
        shadow = JSON.parse(shadowString)
      }
    } catch {
      // Shadow doesn't exist or error - continue without it
    }

    // Determine status from shadow
    const status = shadow?.state?.reported ? 'online' : 'unknown'

    // Get last activity from shadow metadata
    let lastSeen: Date | undefined
    if (shadow?.metadata?.reported) {
      const timestamps = Object.values(shadow.metadata.reported).map(
        (m) => m.timestamp
      )
      if (timestamps.length > 0) {
        lastSeen = new Date(Math.max(...timestamps) * 1000) // Convert to milliseconds
      }
    }

    return {
      id: thingName,
      name: thing.attributes?.name || thingName,
      externalId: thingName,
      status: status as 'online' | 'offline' | 'unknown',
      hardwareIds: thing.attributes?.serialNumber
        ? [thing.attributes.serialNumber]
        : undefined,
      tags: thing.thingTypeName ? [thing.thingTypeName] : undefined,
      metadata: {
        ...thing.attributes,
        thingType: thing.thingTypeName,
        version: thing.version,
        shadow: shadow?.state,
      },
      lastSeen: lastSeen,
      createdAt: new Date(), // AWS doesn't provide creation time via DescribeThing
      updatedAt: new Date(),
    }
  }

  /**
   * Map AWS Shadow to generic DeviceStatus
   */
  private mapShadowToStatus(shadow: AwsShadow): DeviceStatus {
    const reported = shadow.state?.reported || {}

    // Determine connection state
    const connectionState: 'online' | 'offline' | 'unknown' =
      reported.connected === true
        ? 'online'
        : reported.connected === false
          ? 'offline'
          : 'unknown'

    // Get last activity timestamp
    const lastActivity = shadow.timestamp
      ? new Date(shadow.timestamp * 1000)
      : new Date()

    // Extract firmware info
    const firmware = reported.firmware
      ? {
          version: String(reported.firmware),
          updateAvailable: false,
        }
      : undefined

    // Extract health metrics
    const health = {
      battery:
        typeof reported.battery === 'number' ? reported.battery : undefined,
      signalStrength:
        typeof reported.rssi === 'number' ? reported.rssi : undefined,
      temperature:
        typeof reported.temperature === 'number'
          ? reported.temperature
          : undefined,
    }

    return {
      connectionState,
      lastActivity,
      firmware,
      telemetry: reported,
      health,
    }
  }
}
