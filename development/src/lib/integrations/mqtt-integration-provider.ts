/**
 * MQTT Broker Integration Provider
 * ==================================
 * Integrates with generic MQTT brokers for device communication and status tracking.
 *
 * MQTT is a lightweight publish-subscribe messaging protocol commonly used in IoT.
 * This provider connects to any MQTT broker (Mosquitto, HiveMQ, AWS IoT, etc.)
 *
 * Capabilities:
 * - Device presence detection via Last Will and Testament (LWT)
 * - Status updates via subscribed topics
 * - Telemetry collection from device topics
 * - Remote commands via command topics
 *
 * Limitations:
 * - No centralized device registry (devices discovered via MQTT activity)
 * - Limited metadata (depends on message payloads)
 * - No built-in authentication/authorization (handled by broker)
 * - Telemetry depends on custom topic structure
 *
 * MQTT Topic Structure (configurable):
 * - Status: devices/{deviceId}/status
 * - Telemetry: devices/{deviceId}/telemetry
 * - Commands: devices/{deviceId}/commands
 * - LWT: devices/{deviceId}/lwt
 *
 * Date: 2025-11-09
 * Issue: #82 - Complete Integration Provider Implementation
 */

// MQTT client imports
import * as mqtt from 'mqtt'

import {
  DeviceIntegrationProvider,
  DeviceData,
  DeviceStatus,
  DeviceListResult,
  TestConnectionResult,
  TelemetryData,
  DeviceUpdate,
  ProviderCapabilities,
  PaginationOptions,
  ProviderConfig,
} from './base-integration-provider'
import { FrontendActivityLogger } from '@/lib/monitoring/activity-logger'

// ============================================================================
// MQTT Types
// ============================================================================

interface MqttConfig {
  brokerUrl: string // mqtt://broker:1883 or mqtts://broker:8883
  port?: number // Default: 1883 (or 8883 for TLS)
  username?: string
  password?: string
  useTls?: boolean // Default: false
  clientId?: string
  topicPrefix?: string // Default: "devices/"
  statusTopic?: string // Default: "{prefix}{deviceId}/status"
  telemetryTopic?: string // Default: "{prefix}{deviceId}/telemetry"
  commandTopic?: string // Default: "{prefix}{deviceId}/commands"
  lwtTopic?: string // Default: "{prefix}{deviceId}/lwt"
}

interface MqttDeviceMessage {
  deviceId: string
  timestamp: number
  status?: string
  metadata?: Record<string, unknown>
  telemetry?: Record<string, unknown>
}

// ============================================================================
// MQTT Integration Provider
// ============================================================================

export class MqttIntegrationProvider extends DeviceIntegrationProvider {
  override providerId: string
  override providerType = 'mqtt'
  override providerName = 'MQTT Broker'

  private client: mqtt.MqttClient | null = null
  private config: MqttConfig
  private topicPrefix: string
  private activityLogger: FrontendActivityLogger
  private organizationId: string
  private integrationId: string

  // In-memory device cache (MQTT doesn't have a registry)
  private deviceCache = new Map<
    string,
    {
      device: DeviceData
      status: DeviceStatus
      lastUpdate: Date
    }
  >()

  constructor(config: ProviderConfig) {
    super()

    // Extract MQTT-specific config from generic ProviderConfig
    const brokerUrl =
      config.endpoint || (config.credentials?.brokerUrl as string) || ''
    const port = (config.credentials?.port as number) || 1883
    const username = config.apiKey || (config.credentials?.username as string)
    const password = config.credentials?.password as string
    const useTls = (config.credentials?.useTls as boolean) || false
    const clientId =
      (config.credentials?.clientId as string) || `netneural-${Date.now()}`
    const topicPrefix =
      (config.credentials?.topicPrefix as string) || 'devices/'
    const providerId =
      (config.credentials?.integrationId as string) ||
      config.projectId ||
      'mqtt'
    const organizationId = (config.credentials?.organizationId as string) || ''

    this.providerId = providerId
    this.integrationId = providerId
    this.organizationId = organizationId
    this.activityLogger = new FrontendActivityLogger()
    this.config = {
      brokerUrl,
      port,
      username,
      password,
      useTls,
      clientId,
      topicPrefix,
    }
    this.topicPrefix = topicPrefix
  }

  /**
   * Test connection to MQTT broker
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
        endpoint: this.config.brokerUrl,
      },
      async () => {
        return this._testConnectionInternal()
      }
    )
  }

  private async _testConnectionInternal(): Promise<TestConnectionResult> {
    return new Promise((resolve) => {
      const testClient = mqtt.connect(this.config.brokerUrl, {
        username: this.config.username,
        password: this.config.password,
        clientId: this.config.clientId || `test_${Date.now()}`,
        connectTimeout: 5000,
      })

      testClient.on('connect', () => {
        testClient.end()
        resolve({
          success: true,
          message: `Successfully connected to MQTT broker: ${this.config.brokerUrl}`,
        })
      })

      testClient.on('error', (err: Error) => {
        testClient.end()
        resolve({
          success: false,
          message: err.message || 'Failed to connect to MQTT broker',
        })
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!testClient.connected) {
          testClient.end()
          resolve({
            success: false,
            message: 'Connection timeout',
          })
        }
      }, 5000)
    })
  }

  /**
   * List all devices (from cache)
   * MQTT doesn't have a device registry, so we return cached devices
   */
  override async listDevices(
    options?: PaginationOptions
  ): Promise<DeviceListResult> {
    // Ensure client is connected and subscribed
    await this.ensureConnected()

    const devices = Array.from(this.deviceCache.values()).map(
      (entry) => entry.device
    )

    // Apply pagination
    const page = options?.page || 0
    const limit = options?.limit || 100
    const offset = options?.offset || page * limit
    const paginatedDevices = devices.slice(offset, offset + limit)

    return {
      devices: paginatedDevices,
      total: devices.length,
      page,
      limit,
    }
  }

  /**
   * Get a specific device from cache
   */
  override async getDevice(deviceId: string): Promise<DeviceData> {
    await this.ensureConnected()

    const entry = this.deviceCache.get(deviceId)
    if (!entry) {
      throw new Error(`Device ${deviceId} not found in cache`)
    }

    return entry.device
  }

  /**
   * Get device status from cache
   */
  override async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    await this.ensureConnected()

    const entry = this.deviceCache.get(deviceId)
    if (!entry) {
      throw new Error(`Device ${deviceId} not found in cache`)
    }

    return entry.status
  }

  /**
   * Update device metadata (publish to MQTT)
   */
  override async updateDevice(
    deviceId: string,
    updates: DeviceUpdate
  ): Promise<DeviceData> {
    await this.ensureConnected()

    if (!this.client) {
      throw new Error('MQTT client not connected')
    }

    // Update cache
    const entry = this.deviceCache.get(deviceId)
    if (entry) {
      entry.device = {
        ...entry.device,
        name: updates.name || entry.device.name,
        tags: updates.tags || entry.device.tags,
        metadata: { ...entry.device.metadata, ...updates.metadata },
        updatedAt: new Date(),
      }
    }

    // Publish metadata update to MQTT (optional - depends on device implementation)
    const topic = this.getDeviceTopic(deviceId, 'metadata')
    await this.publishAsync(topic, JSON.stringify(updates))

    return this.getDevice(deviceId)
  }

  /**
   * Query telemetry (from cache - limited history)
   */
  override async queryTelemetry(): Promise<TelemetryData[]> {
    try {
      // Query mqtt_messages table for telemetry data
      // We need to import Supabase client to query the database
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const supabase = createClient(supabaseUrl, supabaseKey)

      // Query mqtt_messages for this integration
      const { data: messages, error } = await supabase
        .from('mqtt_messages')
        .select('*')
        .eq('integration_id', this.integrationId)
        .eq('organization_id', this.organizationId)
        .order('received_at', { ascending: false })
        .limit(100) // Limit to last 100 messages

      if (error) {
        console.error('Error querying MQTT messages:', error)
        throw new Error(`Failed to query telemetry: ${error.message}`)
      }

      if (!messages || messages.length === 0) {
        return []
      }

      // Parse messages and extract telemetry data
      const telemetryData: TelemetryData[] = messages
        .filter((msg) => {
          // Filter for telemetry topics
          const topic = msg.topic as string
          return (
            topic.includes('/telemetry') ||
            topic.includes('/data') ||
            topic.includes('/sensor')
          )
        })
        .map((msg) => {
          const payload = msg.payload as Record<string, unknown>
          const topic = msg.topic as string

          // Extract device ID from topic (e.g., "org_xxx/devices/sensor01/telemetry" -> "sensor01")
          const deviceIdMatch = topic.match(/\/devices\/([^/]+)\//)
          const deviceId: string =
            deviceIdMatch && deviceIdMatch[1] ? deviceIdMatch[1] : 'unknown'

          // Extract timestamp from payload or use received_at
          let timestamp: Date
          if (payload.timestamp) {
            timestamp = new Date(payload.timestamp as string | number)
          } else if (payload.ts) {
            timestamp = new Date(payload.ts as string | number)
          } else {
            timestamp = new Date(msg.received_at as string)
          }

          // Extract metrics from payload (exclude metadata fields)
          const metrics: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(payload)) {
            if (!['timestamp', 'ts', 'device_id', 'deviceId'].includes(key)) {
              metrics[key] = value
            }
          }

          return {
            deviceId,
            timestamp,
            metrics,
            path: topic,
          }
        })

      return telemetryData
    } catch (error) {
      console.error('Error in queryTelemetry:', error)
      // Return empty array instead of throwing to maintain backward compatibility
      return []
    }
  }

  /**
   * Get provider capabilities
   */
  override getCapabilities(): ProviderCapabilities {
    return {
      supportsRealTimeStatus: true, // Via subscriptions
      supportsTelemetry: true, // Via topic subscriptions (limited)
      supportsFirmwareManagement: false, // Not built-in
      supportsRemoteCommands: true, // Via command topics
      supportsBidirectionalSync: true, // Can read and write
    }
  }

  /**
   * Ensure MQTT client is connected and subscribed
   */
  private async ensureConnected(): Promise<void> {
    if (this.client && this.client.connected) {
      return
    }

    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(this.config.brokerUrl, {
        username: this.config.username,
        password: this.config.password,
        clientId: this.config.clientId || `provider_${this.providerId}`,
        clean: false, // Persistent session
      })

      this.client.on('connect', () => {
        // Subscribe to all device topics
        const topics = [
          `${this.topicPrefix}+/status`,
          `${this.topicPrefix}+/telemetry`,
          `${this.topicPrefix}+/lwt`,
        ]

        this.client!.subscribe(topics, (err: Error | null) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })

      this.client.on('message', (topic: string, payload: Buffer) => {
        this.handleMessage(topic, payload)
      })

      this.client.on('error', (err: Error) => {
        reject(err)
      })
    })
  }

  /**
   * Handle incoming MQTT messages
   */
  private handleMessage(topic: string, payload: Buffer): void {
    try {
      const message: MqttDeviceMessage = JSON.parse(payload.toString())
      const deviceId = this.extractDeviceIdFromTopic(topic)

      if (!deviceId) return

      // Update or create device cache entry
      const existingEntry = this.deviceCache.get(deviceId)

      if (topic.includes('/status')) {
        this.handleStatusMessage(deviceId, message, existingEntry)
      } else if (topic.includes('/telemetry')) {
        this.handleTelemetryMessage(deviceId, message, existingEntry)
      } else if (topic.includes('/lwt')) {
        this.handleLwtMessage(deviceId, message, existingEntry)
      }
    } catch {
      // Invalid JSON or message format - ignore
    }
  }

  /**
   * Handle status message
   */
  private handleStatusMessage(
    deviceId: string,
    message: MqttDeviceMessage,
    existing?: { device: DeviceData; status: DeviceStatus; lastUpdate: Date }
  ): void {
    const now = new Date()
    const status =
      message.status === 'online'
        ? 'online'
        : message.status === 'offline'
          ? 'offline'
          : 'unknown'

    if (existing) {
      existing.device.status = status as 'online' | 'offline' | 'unknown'
      existing.device.lastSeen = now
      existing.device.updatedAt = now
      existing.status.connectionState = status as
        | 'online'
        | 'offline'
        | 'unknown'
      existing.status.lastActivity = now
      existing.lastUpdate = now
    } else {
      // Create new device entry
      const device: DeviceData = {
        id: deviceId,
        name: (message.metadata?.['name'] as string) || deviceId,
        externalId: deviceId,
        status: status as 'online' | 'offline' | 'unknown',
        metadata: message.metadata,
        lastSeen: now,
        createdAt: now,
        updatedAt: now,
      }

      const deviceStatus: DeviceStatus = {
        connectionState: status as 'online' | 'offline' | 'unknown',
        lastActivity: now,
        telemetry: {},
      }

      this.deviceCache.set(deviceId, {
        device,
        status: deviceStatus,
        lastUpdate: now,
      })
    }
  }

  /**
   * Handle telemetry message
   */
  private handleTelemetryMessage(
    deviceId: string,
    message: MqttDeviceMessage,
    existing?: { device: DeviceData; status: DeviceStatus; lastUpdate: Date }
  ): void {
    if (existing && message.telemetry) {
      existing.status.telemetry = {
        ...existing.status.telemetry,
        ...message.telemetry,
      }
      existing.lastUpdate = new Date()
    }
  }

  /**
   * Handle Last Will and Testament message (device disconnect)
   */
  private handleLwtMessage(
    deviceId: string,
    _message: MqttDeviceMessage,
    existing?: { device: DeviceData; status: DeviceStatus; lastUpdate: Date }
  ): void {
    if (existing) {
      existing.device.status = 'offline'
      existing.status.connectionState = 'offline'
      existing.lastUpdate = new Date()
    }
  }

  /**
   * Extract device ID from MQTT topic
   */
  private extractDeviceIdFromTopic(topic: string): string | null {
    // Topic format: devices/{deviceId}/status
    const match = topic.match(/devices\/([^/]+)\//)
    return match ? (match[1] ?? null) : null
  }

  /**
   * Get topic for a specific device and message type
   */
  private getDeviceTopic(deviceId: string, type: string): string {
    return `${this.topicPrefix}${deviceId}/${type}`
  }

  /**
   * Publish message to MQTT (promisified)
   */
  private async publishAsync(topic: string, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('MQTT client not connected'))
        return
      }

      this.client.publish(topic, message, {}, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * Cleanup: disconnect MQTT client
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await new Promise<void>((resolve) => {
        this.client!.end(false, {}, () => resolve())
      })
      this.client = null
    }
  }
}
