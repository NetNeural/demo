// ===========================================================================
// Webhook Payload Mappers - Integration-Specific
// ===========================================================================
// Maps incoming webhook payloads from different IoT platforms to a unified format
// Each integration has its own webhook payload structure
// ===========================================================================

export interface NormalizedWebhookPayload {
  event: string
  deviceId: string
  deviceName?: string
  status?: string
  lastSeen?: string
  metadata?: Record<string, unknown>
  timestamp?: string
}

export interface RawWebhookPayload {
  event?: string
  timestamp?: string
  // Golioth format
  device?: {
    id?: string
    deviceId?: string
    name?: string
    status?: string
    state?: string
    lastSeen?: string
    last_seen?: string
    metadata?: Record<string, unknown>
    tags?: Record<string, unknown>
    [key: string]: unknown
  }
  // Generic data format
  data?: {
    deviceId?: string
    device_id?: string
    status?: string
    state?: string
    lastSeen?: string
    last_seen?: string
    metadata?: Record<string, unknown>
    [key: string]: unknown
  }
  // AWS IoT format
  deviceId?: string
  device_id?: string
  connectionState?: string
  eventTime?: string
  attributes?: Record<string, unknown>
  // Azure IoT Hub format
  lastActivityTime?: string
  properties?: Record<string, unknown>
  // Golioth telemetry format
  telemetry?: {
    type?: number
    units?: number
    value?: number
    sensor?: string
    timestamp?: string
    [key: string]: unknown
  }
  device_name?: string
  // Allow any additional fields
  [key: string]: unknown
}

// ===========================================================================
// Golioth Webhook Mapper
// ===========================================================================
export function mapGoliothWebhook(payload: RawWebhookPayload): NormalizedWebhookPayload {
  const device = payload.device || payload.data || {}
  
  // Golioth telemetry webhooks send device_name at top level (e.g., "M260600008")
  // This maps to serial_number in our devices table
  const deviceName = (payload.device_name as string) || (device.name as string)
  
  // Golioth telemetry events have telemetry at the top level:
  // { event: "device.telemetry", telemetry: { type, units, value, sensor, timestamp }, device_name: "..." }
  const telemetry = payload.telemetry as Record<string, unknown> | undefined
  const telemetryTimestamp = (telemetry?.timestamp as string) || payload.timestamp
  
  // Build metadata, ensuring telemetry data is preserved
  const baseMetadata = device.metadata || device.tags || payload.metadata || {}
  const metadata: Record<string, unknown> = {
    ...(typeof baseMetadata === 'object' && baseMetadata !== null ? baseMetadata : {}),
  }
  
  // Include telemetry in metadata so the handler can store it
  if (telemetry) {
    metadata.telemetry = telemetry
  }
  
  return {
    event: payload.event || 'unknown',
    deviceId: device.id || device.deviceId || device.device_id || payload.device_id || payload.deviceId || deviceName || '',
    deviceName: deviceName,
    status: device.status || device.state || payload.status,
    lastSeen: device.lastSeen || device.last_seen || telemetryTimestamp,
    metadata: Object.keys(metadata).length > 0 ? metadata : device,
    timestamp: telemetryTimestamp,
  }
}

// ===========================================================================
// AWS IoT Webhook Mapper
// ===========================================================================
export function mapAwsIotWebhook(payload: RawWebhookPayload): NormalizedWebhookPayload {
  const device = payload.device || payload
  
  return {
    event: payload.event || 'device.updated',
    deviceId: payload.deviceId || device.deviceId || '',
    deviceName: device.name as string,
    status: payload.connectionState || device.connectionState || device.status,
    lastSeen: payload.eventTime || device.eventTime || payload.timestamp,
    metadata: payload.attributes || device.attributes || device.metadata || device,
    timestamp: payload.eventTime || payload.timestamp,
  }
}

// ===========================================================================
// Azure IoT Hub Webhook Mapper
// ===========================================================================
export function mapAzureIotWebhook(payload: RawWebhookPayload): NormalizedWebhookPayload {
  const device = payload.device || payload.data || payload
  
  return {
    event: payload.event || 'device.updated',
    deviceId: payload.deviceId || device.deviceId || '',
    deviceName: device.name as string,
    status: device.connectionState || device.status,
    lastSeen: payload.lastActivityTime || device.lastActivityTime || payload.eventTime || payload.timestamp,
    metadata: payload.properties || device.properties || device.tags || device.metadata || device,
    timestamp: payload.eventTime || payload.timestamp,
  }
}

// ===========================================================================
// MQTT Webhook Mapper
// ===========================================================================
export function mapMqttWebhook(payload: RawWebhookPayload): NormalizedWebhookPayload {
  const device = payload.device || payload.data || payload
  
  return {
    event: payload.event || 'device.updated',
    deviceId: payload.device_id || payload.deviceId || device.device_id || device.deviceId || '',
    deviceName: device.name as string,
    status: device.status || device.state,
    lastSeen: device.last_seen || device.lastSeen || payload.timestamp,
    metadata: device.metadata || device,
    timestamp: payload.timestamp,
  }
}

// ===========================================================================
// Custom Webhook Mapper (for outgoing webhooks to user endpoints)
// ===========================================================================
export function mapCustomWebhook(payload: RawWebhookPayload): NormalizedWebhookPayload {
  // Custom webhooks should already be in a clean format
  // This is for incoming webhooks FROM external platforms TO our platform
  const device = payload.device || payload.data || {}
  
  return {
    event: payload.event || 'device.updated',
    deviceId: (device.deviceId || device.device_id || payload.deviceId || payload.device_id || '') as string,
    deviceName: (device.name || payload.name) as string,
    status: device.status || device.state,
    lastSeen: device.lastSeen || device.last_seen || payload.timestamp,
    metadata: device.metadata || device,
    timestamp: payload.timestamp || new Date().toISOString(),
  }
}

// ===========================================================================
// Main Mapper Router
// ===========================================================================
export function mapWebhookPayload(
  integrationType: string,
  payload: RawWebhookPayload
): NormalizedWebhookPayload {
  switch (integrationType) {
    case 'golioth':
      return mapGoliothWebhook(payload)
    
    case 'aws_iot':
    case 'aws-iot':
      return mapAwsIotWebhook(payload)
    
    case 'azure_iot':
    case 'azure-iot':
      return mapAzureIotWebhook(payload)
    
    case 'mqtt':
      return mapMqttWebhook(payload)
    
    case 'webhook':
    case 'custom_webhook':
      return mapCustomWebhook(payload)
    
    default: {
      // Generic fallback
      const device = payload.device || payload.data || {}
      return {
        event: payload.event || 'unknown',
        deviceId: (device.deviceId || device.device_id || payload.deviceId || payload.device_id || '') as string,
        deviceName: (device.name || payload.name) as string,
        status: device.status || device.state,
        lastSeen: device.lastSeen || device.last_seen || payload.timestamp,
        metadata: device.metadata || device,
        timestamp: payload.timestamp,
      }
    }
  }
}
