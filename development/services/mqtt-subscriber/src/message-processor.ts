/**
 * Message Processor
 * =================
 * Parses MQTT messages and stores them in Supabase
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Logger } from 'pino'
import {
  MqttIntegration,
  ProcessedMessage,
  TelemetryRecord,
  ActivityLogEntry,
} from './types'

export class MessageProcessor {
  constructor(
    private supabase: SupabaseClient,
    private logger: Logger
  ) {}

  async process(
    integration: MqttIntegration,
    topic: string,
    messageStr: string
  ): Promise<ProcessedMessage | null> {
    const startTime = Date.now()

    try {
      // Parse the message
      const parsed = this.parseMessage(integration, topic, messageStr)

      if (!parsed) {
        this.logger.warn(
          { topic, integration: integration.name },
          'Failed to parse message'
        )
        return null
      }

      // Check if device exists, create if needed - get back the UUID
      const deviceUuid = await this.ensureDeviceExists(
        parsed.deviceId,
        integration.organizationId,
        integration.id
      )

      // Store telemetry data if present (requires UUID)
      if (deviceUuid && parsed.telemetry && Object.keys(parsed.telemetry).length > 0) {
        await this.storeTelemetry(parsed, integration, deviceUuid)
      }

      // Update device status if present (use UUID)
      if (deviceUuid && parsed.status) {
        await this.updateDeviceStatus(deviceUuid, parsed.status)
      }

      // Log activity
      await this.logActivity({
        organization_id: integration.organizationId,
        integration_id: integration.id,
        direction: 'incoming',
        activity_type: 'mqtt_message_received',
        method: 'SUBSCRIBE',
        endpoint: topic,
        status: 'success',
        response_time_ms: Date.now() - startTime,
        metadata: {
          deviceId: parsed.deviceId,
          messageSize: messageStr.length,
          telemetryKeys: parsed.telemetry ? Object.keys(parsed.telemetry) : [],
          rawPayload: messageStr.substring(0, 500), // First 500 chars for debugging
          parser: integration.settings.payloadParser || integration.settings.payload_parser || 'standard',
        },
      })

      return parsed
    } catch (error) {
      this.logger.error(
        { error, topic, integration: integration.name },
        'Message processing error'
      )

      // Log failed activity
      await this.logActivity({
        organization_id: integration.organizationId,
        integration_id: integration.id,
        direction: 'incoming',
        activity_type: 'mqtt_message_received',
        method: 'SUBSCRIBE',
        endpoint: topic,
        status: 'failed',
        response_time_ms: Date.now() - startTime,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })

      return null
    }
  }

  private parseMessage(
    integration: MqttIntegration,
    topic: string,
    messageStr: string
  ): ProcessedMessage | null {
    try {
      // Try to parse as JSON
      const payload = JSON.parse(messageStr)

      // Extract device ID from topic or payload
      const deviceId = this.extractDeviceId(topic, payload, integration)

      if (!deviceId) {
        this.logger.warn({ topic, payload }, 'Could not extract device ID')
        return null
      }

      // Parse based on configured parser
      const parser =
        integration.settings.payloadParser ||
        integration.settings.payload_parser ||
        'standard'

      this.logger.info(
        { parser, deviceId, payloadKeys: Object.keys(payload) },
        'Parsing message with selected parser'
      )

      switch (parser) {
        case 'vmark':
          return this.parseVMarkMessage(deviceId, payload)
        case 'custom':
          return this.parseCustomMessage(
            deviceId,
            payload,
            integration.settings.customParserConfig ||
              integration.settings.custom_parser_config
          )
        default:
          return this.parseStandardMessage(deviceId, payload)
      }
    } catch (error) {
      // Not JSON, try plain text
      const deviceId = this.extractDeviceId(topic, {}, integration)
      if (!deviceId) return null

      return {
        deviceId,
        metadata: { raw_message: messageStr },
        timestamp: new Date().toISOString(),
      }
    }
  }

  private extractDeviceId(
    topic: string,
    payload: any,
    integration: MqttIntegration
  ): string | null {
    // Try to extract from payload first
    // Check common field names: device, deviceId, device_id, id
    if (payload.device || payload.deviceId || payload.device_id || payload.id) {
      return payload.device || payload.deviceId || payload.device_id || payload.id
    }

    // Extract from topic pattern: devices/{deviceId}/...
    const topicMatch = topic.match(/devices\/([^/]+)/)
    if (topicMatch) {
      return topicMatch[1]
    }

    // Try another common pattern: {prefix}/{deviceId}/...
    const prefix =
      integration.settings.topicPrefix ||
      integration.settings.topic_prefix ||
      'netneural'
    const prefixMatch = topic.match(new RegExp(`${prefix}/([^/]+)`))
    if (prefixMatch) {
      return prefixMatch[1]
    }

    return null
  }

  private parseStandardMessage(
    deviceId: string,
    payload: any
  ): ProcessedMessage {
    const telemetry: Record<string, any> = {}

    // Extract known telemetry fields
    const telemetryFields = [
      'temperature',
      'humidity',
      'pressure',
      'battery',
      'voltage',
      'current',
      'power',
      'rssi',
      'snr',
      'battery_level',
      'signal_strength',
    ]

    for (const field of telemetryFields) {
      if (payload[field] !== undefined) {
        telemetry[field] = payload[field]
      }
    }

    // If no specific fields found, use all numeric values
    if (Object.keys(telemetry).length === 0) {
      for (const [key, value] of Object.entries(payload)) {
        if (
          typeof value === 'number' &&
          !['timestamp', 'ts', 'time'].includes(key.toLowerCase())
        ) {
          telemetry[key] = value
        }
      }
    }

    return {
      deviceId,
      telemetry: Object.keys(telemetry).length > 0 ? telemetry : undefined,
      status: payload.status,
      timestamp: payload.timestamp || payload.ts || new Date().toISOString(),
      metadata: payload,
    }
  }

  private parseVMarkMessage(deviceId: string, payload: any): ProcessedMessage {
    // VMark-specific parsing
    // Expected format: { "device": "xxx", "handle": "properties_report", "paras": {...}, "time": "..." }
    const telemetry: Record<string, any> = {}

    this.logger.info(
      { 
        deviceId, 
        hasParas: !!payload.paras, 
        hasData: !!payload.data,
        payloadKeys: Object.keys(payload),
        parasKeys: payload.paras ? Object.keys(payload.paras) : []
      },
      'Parsing V-Mark message'
    )

    // Extract telemetry from 'paras' field (VMark protocol)
    if (payload.paras && typeof payload.paras === 'object') {
      Object.assign(telemetry, payload.paras)
    }
    // Fallback to 'data' field for compatibility
    else if (payload.data && typeof payload.data === 'object') {
      Object.assign(telemetry, payload.data)
    }

    this.logger.info(
      { telemetryKeys: Object.keys(telemetry), telemetry },
      'Extracted V-Mark telemetry'
    )

    // Parse VMark timestamp format: "2025-04-23_07:35:22.214"
    let timestamp = new Date().toISOString()
    if (payload.time) {
      try {
        // Convert VMark format to ISO: "2025-04-23_07:35:22.214" -> "2025-04-23T07:35:22.214Z"
        const isoTime = payload.time.replace('_', 'T') + 'Z'
        timestamp = new Date(isoTime).toISOString()
      } catch {
        // If parsing fails, use current time
        timestamp = new Date().toISOString()
      }
    } else if (payload.timestamp) {
      timestamp = payload.timestamp
    }

    return {
      deviceId: payload.device || deviceId,
      telemetry: Object.keys(telemetry).length > 0 ? telemetry : undefined,
      status: payload.online ? 'online' : undefined,
      timestamp,
      metadata: payload,
    }
  }

  private parseCustomMessage(
    deviceId: string,
    payload: any,
    config: any
  ): ProcessedMessage {
    const telemetry: Record<string, any> = {}

    if (config?.telemetry_path) {
      const telemetryData = this.getNestedValue(payload, config.telemetry_path)
      if (telemetryData && typeof telemetryData === 'object') {
        Object.assign(telemetry, telemetryData)
      }
    }

    const timestamp = config?.timestamp_path
      ? this.getNestedValue(payload, config.timestamp_path)
      : new Date().toISOString()

    return {
      deviceId,
      telemetry: Object.keys(telemetry).length > 0 ? telemetry : undefined,
      timestamp,
      metadata: payload,
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  private async ensureDeviceExists(
    deviceId: string,
    organizationId: string,
    integrationId: string
  ): Promise<string | null> {
    // Look up device by hardware_ids array first
    const { data: existing } = await this.supabase
      .from('devices')
      .select('id')
      .contains('hardware_ids', [deviceId])
      .eq('organization_id', organizationId)
      .single()

    if (existing) {
      return existing.id
    }

    // Create device with hardware_ids
    const { data: created, error } = await this.supabase
      .from('devices')
      .insert({
        name: `MQTT Device ${deviceId}`,
        organization_id: organizationId,
        hardware_ids: [deviceId],
        status: 'online',
        metadata: {
          auto_discovered: true,
          discovered_at: new Date().toISOString(),
          integration_id: integrationId,
        },
      })
      .select('id')
      .single()

    if (error || !created) {
      this.logger.error({ error, deviceId }, 'Failed to auto-create device')
      return null
    }

    this.logger.info(
      { deviceId, organizationId, uuid: created.id },
      'Auto-discovered and created device'
    )
    return created.id
  }

  private async storeTelemetry(
    parsed: ProcessedMessage,
    integration: MqttIntegration,
    deviceUuid: string
  ): Promise<void> {
    if (!parsed.telemetry) return

    const timestamp = parsed.timestamp || new Date().toISOString()

    // Store as a single JSONB record (matches device_telemetry_history schema)
    const { error } = await this.supabase
      .from('device_telemetry_history')
      .insert({
        device_id: deviceUuid,
        organization_id: integration.organizationId,
        telemetry: parsed.telemetry,
        device_timestamp: timestamp,
        received_at: new Date().toISOString(),
      })

    if (error) {
      this.logger.error(
        { error, deviceId: parsed.deviceId, deviceUuid },
        'Failed to store telemetry'
      )
    } else {
      this.logger.info(
        { deviceUuid, keys: Object.keys(parsed.telemetry) },
        'Telemetry stored successfully'
      )
    }
  }

  private async updateDeviceStatus(
    deviceId: string,
    status: string
  ): Promise<void> {
    await this.supabase
      .from('devices')
      .update({
        status,
        last_seen: new Date().toISOString(),
      })
      .eq('id', deviceId)
  }

  private async logActivity(entry: ActivityLogEntry): Promise<void> {
    const { error } = await this.supabase
      .from('integration_activity_log')
      .insert(entry)

    if (error) {
      this.logger.error({ error }, 'Failed to log activity')
    }
  }
}
