export interface MqttIntegration {
  id: string
  name: string
  organizationId: string
  integrationType: 'mqtt' | 'mqtt_external' | 'mqtt_hosted'
  settings: MqttSettings
  status: string
}

export interface MqttSettings {
  brokerUrl?: string
  broker_url?: string
  port?: number
  username?: string
  password?: string
  clientId?: string
  client_id?: string
  useTls?: boolean
  use_tls?: boolean
  topics?: string | string[]
  topicPrefix?: string
  topic_prefix?: string
  payloadParser?: 'standard' | 'vmark' | 'custom'
  payload_parser?: 'standard' | 'vmark' | 'custom'
  customParserConfig?: CustomParserConfig
  custom_parser_config?: CustomParserConfig
}

export interface CustomParserConfig {
  device_id_path?: string
  telemetry_path?: string
  timestamp_path?: string
  timestamp_format?: string
}

export interface ProcessedMessage {
  deviceId: string
  telemetry?: Record<string, any>
  status?: 'online' | 'offline' | 'unknown'
  timestamp?: string
  metadata?: Record<string, any>
  /** Topic the subscriber should publish an ACK to (V-Mark protocol) */
  ackTopic?: string
  /** Payload to publish as the ACK */
  ackPayload?: string
}

export interface TelemetryRecord {
  device_id: string
  organization_id: string
  integration_id: string
  metric_name: string
  metric_value: number
  unit?: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface ActivityLogEntry {
  organization_id: string
  integration_id: string
  direction: 'incoming' | 'outgoing'
  activity_type: string
  method: string
  endpoint: string
  status: 'success' | 'failed' | 'error'
  response_time_ms?: number
  metadata?: Record<string, any>
  error_message?: string
}
