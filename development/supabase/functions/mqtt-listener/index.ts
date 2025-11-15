import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// MQTT library temporarily disabled - function handles HTTP webhooks instead
// import { connect } from 'https://deno.land/x/mqtt@0.1.2/mod.ts'

/**
 * MQTT Listener Service
 * ======================
 * Persistent MQTT connection that:
 * 1. Subscribes to configured topics
 * 2. Processes incoming messages in real-time
 * 3. Logs events to integration_activity_log
 * 4. Stores telemetry to device_telemetry_history (time-series only)
 * 5. Generates alerts when needed
 * 
 * ARCHITECTURE:
 * - High-level events (device discovered, status change) → integration_activity_log
 * - Telemetry data (temperature, battery, etc.) → device_telemetry_history
 * - Metadata in activity_log links to telemetry via activity_log_id
 * 
 * This is a long-running edge function with persistent MQTT connections.
 */

interface MqttConfig {
  broker_url: string
  port: number
  username?: string
  password?: string
  client_id?: string
  topics?: string
  use_tls: boolean
  payload_parser?: 'standard' | 'vmark' | 'custom'
  custom_parser_config?: {
    device_id_path?: string
    telemetry_path?: string
    timestamp_path?: string
    timestamp_format?: string
  }
}

interface ParsedMessage {
  deviceId: string
  telemetry?: Record<string, unknown>
  status?: 'online' | 'offline' | 'unknown'
  timestamp?: string
  metadata?: Record<string, unknown>
}

// ============================================================================
// Payload Parsers
// ============================================================================

function parseStandardPayload(payload: string): ParsedMessage | null {
  try {
    const data = JSON.parse(payload)
    return {
      deviceId: data.id || data.deviceId || data.device_id,
      telemetry: data.data || data.telemetry,
      status: data.status,
      timestamp: data.timestamp || data.time,
      metadata: data.metadata,
    }
  } catch {
    return null
  }
}

function parseVMarkPayload(payload: string): ParsedMessage | null {
  try {
    const data = JSON.parse(payload)
    // VMark format: { device, handle, paras, time, product, service }
    return {
      deviceId: data.device,
      telemetry: {
        ...(data.paras || {}),
        product: data.product,
        service: data.service,
        handle: data.handle,
      },
      status: data.paras?.status || 'online', // If sending telemetry, assume online
      timestamp: data.time,
      metadata: {
        product: data.product,
        service: data.service,
      },
    }
  } catch {
    return null
  }
}

function parseCustomPayload(
  payload: string,
  config: MqttConfig['custom_parser_config']
): ParsedMessage | null {
  try {
    const data = JSON.parse(payload)
    
    // Extract fields using configured paths
    const deviceId = config?.device_id_path
      ? getNestedValue(data, config.device_id_path)
      : data.device || data.deviceId
      
    const telemetry = config?.telemetry_path
      ? getNestedValue(data, config.telemetry_path)
      : data.data || data
      
    const timestamp = config?.timestamp_path
      ? getNestedValue(data, config.timestamp_path)
      : data.timestamp
    
    return {
      deviceId,
      telemetry,
      timestamp,
      metadata: data,
    }
  } catch {
    return null
  }
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

// ============================================================================
// Message Handler
// ============================================================================

async function handleMqttMessage(
  topic: string,
  payload: string,
  config: MqttConfig,
  integration: any,
  supabase: any
) {
  // Parse message based on configured parser
  let parsed: ParsedMessage | null = null
  
  switch (config.payload_parser) {
    case 'vmark':
      parsed = parseVMarkPayload(payload)
      break
    case 'custom':
      parsed = parseCustomPayload(payload, config.custom_parser_config)
      break
    default:
      parsed = parseStandardPayload(payload)
  }
  
  if (!parsed || !parsed.deviceId) {
    console.error('Failed to parse MQTT message:', { topic, payload })
    return
  }
  
  // Find or create device in database
  const { data: device, error: deviceError } = await supabase
    .from('devices')
    .select('id, organization_id, status')
    .eq('external_id', parsed.deviceId)
    .eq('organization_id', integration.organization_id)
    .single()
  
  if (deviceError && deviceError.code !== 'PGRST116') {
    console.error('Device lookup failed:', deviceError)
    return
  }
  
  let deviceId: string
  let previousStatus: string | undefined
  let isNewDevice = false
  
  if (!device) {
    // Create new device (discovered via MQTT)
    const { data: newDevice, error: createError } = await supabase
      .from('devices')
      .insert({
        name: parsed.deviceId,
        external_id: parsed.deviceId,
        organization_id: integration.organization_id,
        status: parsed.status || 'online',
        metadata: {
          discovered_via: 'mqtt',
          integration_id: integration.id,
          first_seen_topic: topic,
          ...parsed.metadata,
        },
      })
      .select()
      .single()
    
    if (createError) {
      console.error('Device creation failed:', createError)
      return
    }
    
    deviceId = newDevice.id
    previousStatus = undefined
    isNewDevice = true
    
    // Log device discovery to activity log
    await supabase.from('integration_activity_log').insert({
      organization_id: integration.organization_id,
      integration_id: integration.id,
      direction: 'incoming',
      activity_type: 'mqtt_device_discovered',
      status: 'success',
      metadata: {
        device_id: deviceId,
        external_id: parsed.deviceId,
        discovery_topic: topic,
        device_metadata: parsed.metadata,
      },
    })
  } else {
    deviceId = device.id
    previousStatus = device.status
  }
  
  // 1. ALWAYS log message received to activity log (high-level event)
  const { data: activityLog, error: activityError } = await supabase
    .from('integration_activity_log')
    .insert({
      organization_id: integration.organization_id,
      integration_id: integration.id,
      direction: 'incoming',
      activity_type: 'mqtt_message_received',
      status: 'success',
      metadata: {
        device_id: deviceId,
        external_id: parsed.deviceId,
        topic,
        parser_type: config.payload_parser || 'standard',
        has_telemetry: !!(parsed.telemetry && Object.keys(parsed.telemetry).length > 0),
        telemetry_fields: parsed.telemetry ? Object.keys(parsed.telemetry) : [],
        message_timestamp: parsed.timestamp,
      },
    })
    .select()
    .single()
    
  if (activityError) {
    console.error('Activity log insert failed:', activityError)
  }
  
  // 2. Save telemetry if present (time-series table, link to activity log)
  if (parsed.telemetry && Object.keys(parsed.telemetry).length > 0) {
    const { error: telemetryError } = await supabase.rpc('record_device_telemetry', {
      p_device_id: deviceId,
      p_organization_id: integration.organization_id,
      p_telemetry: parsed.telemetry,
      p_device_timestamp: parsed.timestamp ? new Date(parsed.timestamp).toISOString() : null,
      p_activity_log_id: activityLog?.id || null,
    })
    
    if (telemetryError) {
      console.error('Telemetry insert failed:', telemetryError)
    }
    
    // Check alert rules for telemetry thresholds
    await checkTelemetryAlerts(deviceId, parsed.telemetry, integration.organization_id, supabase)
  }
  
  // 3. Handle status changes (log to activity log, NOT separate table)
  const isLwtTopic = topic.includes('/lwt') || topic.includes('/last-will')
  const newStatus = isLwtTopic ? 'offline' : (parsed.status || 'online')
  
  if (previousStatus !== newStatus) {
    // Log status change to activity log
    await supabase.from('integration_activity_log').insert({
      organization_id: integration.organization_id,
      integration_id: integration.id,
      direction: 'incoming',
      activity_type: newStatus === 'online' ? 'mqtt_device_online' : 'mqtt_device_offline',
      status: 'success',
      metadata: {
        device_id: deviceId,
        external_id: parsed.deviceId,
        previous_status: previousStatus,
        new_status: newStatus,
        status_reason: isLwtTopic ? 'lwt_message' : 'mqtt_heartbeat',
        topic,
        connection_quality: extractConnectionQuality(parsed.telemetry),
      },
    })
    
    // Update device status in devices table
    await supabase
      .from('devices')
      .update({ 
        status: newStatus,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', deviceId)
    
    // Generate alert if device went offline
    if (newStatus === 'offline') {
      await generateDeviceOfflineAlert(deviceId, integration.organization_id, supabase)
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function determineTelemetryType(telemetry: Record<string, unknown>): string {
  // Auto-detect telemetry type based on fields
  if ('temperature' in telemetry || 'humidity' in telemetry) return 'environmental'
  if ('lat' in telemetry || 'lon' in telemetry || 'latitude' in telemetry) return 'location'
  if ('battery' in telemetry || 'voltage' in telemetry) return 'power'
  if ('rssi' in telemetry || 'snr' in telemetry) return 'connectivity'
  return 'custom'
}

function extractConnectionQuality(telemetry?: Record<string, unknown>): any {
  if (!telemetry) return null
  
  const quality: any = {}
  if ('rssi' in telemetry) quality.rssi = telemetry.rssi
  if ('snr' in telemetry) quality.snr = telemetry.snr
  if ('RSSI' in telemetry) quality.rssi = telemetry.RSSI
  if ('SNR' in telemetry) quality.snr = telemetry.SNR
  
  return Object.keys(quality).length > 0 ? quality : null
}

async function checkTelemetryAlerts(
  deviceId: string,
  telemetry: Record<string, unknown>,
  organizationId: string,
  supabase: any
) {
  // Query alert rules for this device/organization
  const { data: rules } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('enabled', true)
    .or(`device_id.eq.${deviceId},device_id.is.null`) // Device-specific or org-wide rules
  
  if (!rules || rules.length === 0) return
  
  for (const rule of rules) {
    const triggered = evaluateAlertRule(rule, telemetry)
    
    if (triggered) {
      // Create alert
      await supabase.from('alerts').insert({
        id: crypto.randomUUID(), // Explicitly generate UUID to avoid Supabase client caching bug
        organization_id: organizationId,
        device_id: deviceId,
        rule_id: rule.id,
        severity: rule.severity,
        title: rule.name,
        message: `Alert triggered: ${rule.condition}`,
        metadata: {
          telemetry,
          rule_condition: rule.condition,
          triggered_at: new Date().toISOString(),
        },
      })
    }
  }
}

function evaluateAlertRule(rule: any, telemetry: Record<string, unknown>): boolean {
  // Simple rule evaluation (extend as needed)
  try {
    const condition = rule.condition // e.g., "temperature > 30"
    const [field, operator, value] = condition.split(' ')
    const actualValue = telemetry[field]
    
    if (actualValue === undefined) return false
    
    switch (operator) {
      case '>': return Number(actualValue) > Number(value)
      case '<': return Number(actualValue) < Number(value)
      case '>=': return Number(actualValue) >= Number(value)
      case '<=': return Number(actualValue) <= Number(value)
      case '==': return actualValue == value
      case '!=': return actualValue != value
      default: return false
    }
  } catch {
    return false
  }
}

async function generateDeviceOfflineAlert(
  deviceId: string,
  organizationId: string,
  supabase: any
) {
  await supabase.from('alerts').insert({
    id: crypto.randomUUID(), // Explicitly generate UUID to avoid Supabase client caching bug
    organization_id: organizationId,
    device_id: deviceId,
    severity: 'warning',
    title: 'Device Offline',
    message: 'Device has gone offline (MQTT LWT received)',
    metadata: {
      triggered_at: new Date().toISOString(),
      source: 'mqtt_lwt',
    },
  })
}

// ============================================================================
// Main Service
// ============================================================================
// NOTE: This function requires persistent MQTT connections which are not
// supported in serverless edge functions. This is a placeholder implementation.
// For production, use mqtt-broker function with webhook/polling instead.

serve(async (_req) => {
  return new Response(
    JSON.stringify({ 
      error: 'MQTT Listener requires persistent connections - not supported in edge functions',
      message: 'Use mqtt-broker function with webhook/polling instead',
      status: 'disabled'
    }),
    { 
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    }
  )
  
  /* DISABLED - Requires persistent connections
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get all active MQTT integrations
    const { data: integrations, error: integrationsError } = await supabase
      .from('device_integrations')
      .select('*')
      .eq('type', 'mqtt')
      .eq('enabled', true)
    
    if (integrationsError) {
      throw integrationsError
    }
    
    if (!integrations || integrations.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active MQTT integrations found' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`Starting MQTT listeners for ${integrations.length} integration(s)`)
    
    // Start listener for each integration
    const connections = []
    
    for (const integration of integrations) {
      const config: MqttConfig = integration.config as MqttConfig
      
      const brokerUrl = config.use_tls 
        ? config.broker_url.replace('mqtt://', 'mqtts://') 
        : config.broker_url
      
      const topics = (config.topics || 'devices/+/telemetry,devices/+/status,devices/+/lwt')
        .split(',')
        .map(t => t.trim())
      
      // Connect to MQTT broker
      const client = await connect({
        hostname: new URL(brokerUrl).hostname,
        port: config.port || (config.use_tls ? 8883 : 1883),
        username: config.username,
        password: config.password,
        clientId: config.client_id || `listener_${integration.id}`,
      })
      
      // Subscribe to topics
      for (const topic of topics) {
        await client.subscribe(topic)
        console.log(`Subscribed to ${topic} for integration ${integration.id}`)
      }
      
      // Handle messages
      for await (const message of client) {
        const payload = new TextDecoder().decode(message.payload)
        await handleMqttMessage(
          message.topic,
          payload,
          config,
          integration,
          supabase
        )
      }
      
      connections.push(client)
    }
    
    // Keep function alive
    return new Response(
      JSON.stringify({ 
        message: 'MQTT listeners active',
        integrations: integrations.length,
        status: 'running',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('MQTT Listener error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
  */
})
