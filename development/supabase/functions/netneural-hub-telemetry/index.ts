// ===========================================================================
// NetNeural Hub Edge Functions - Multi-Protocol Telemetry Ingestion
// ===========================================================================
// Unified endpoint for all NetNeural device protocols (CoAP, MQTT, HTTPS)
// Automatically routes to appropriate device handlers and stores telemetry
//
// Features:
// - Protocol auto-detection from headers/request format
// - Device type identification and routing
// - Telemetry normalization and storage
// - Alert processing for thresholds
// - Real-time subscriptions for dashboard updates
// ===========================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  createSuccessResponse,
  createErrorResponse,
} from '../_shared/create-edge-function.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { NetNeuralHubClient } from '../_shared/netneural-hub-client.ts'

// Protocol detection from request
function detectProtocol(req: Request): string {
  const protocolHeader = req.headers.get('x-protocol')
  if (protocolHeader) return protocolHeader

  const contentType = req.headers.get('content-type')
  const userAgent = req.headers.get('user-agent')

  // CoAP typically uses specific content types
  if (
    contentType?.includes('application/cbor') ||
    userAgent?.includes('coap')
  ) {
    return 'coap'
  }

  // MQTT bridge requests
  if (
    contentType?.includes('application/json') &&
    userAgent?.includes('mqtt')
  ) {
    return 'mqtt'
  }

  // Default to HTTPS
  return 'https'
}

// Extract potential sensor values from binary data patterns
function extractBinaryValues(data: Uint8Array): Record<string, number> {
  const values: Record<string, number> = {}

  try {
    // Common IoT patterns: 4-byte floats, 2-byte integers
    const view = new DataView(data.buffer)

    // Try to extract common sensor values
    if (data.length >= 4) {
      values.sensor1 = view.getFloat32(0, true) // Little endian
    }
    if (data.length >= 8) {
      values.sensor2 = view.getFloat32(4, true)
    }
    if (data.length >= 12) {
      values.sensor3 = view.getFloat32(8, true)
    }

    // Add timestamp if present (typically first 8 bytes for unix timestamp)
    if (data.length >= 8) {
      const timestamp = view.getBigUint64(0, true)
      if (timestamp > BigInt(0) && timestamp < BigInt(Date.now() + 86400000)) {
        values.timestamp = Number(timestamp)
      }
    }
  } catch (_error) {
    // Fallback: simple byte interpretation
    values.raw_length = data.length
    values.first_byte = data[0] || 0
    values.last_byte = data[data.length - 1] || 0
  }

  return values
}

// Extract device ID from various request formats
function extractDeviceId(
  req: Request,
  body: any,
  _protocol: string
): string | null {
  const url = new URL(req.url)

  // Path-based device ID: /v1/devices/{device_id}/telemetry
  const pathMatch = url.pathname.match(/\/v1\/devices\/([^\/]+)\//)
  if (pathMatch?.[1]) return pathMatch[1]

  // Header-based device ID
  const headerDeviceId = req.headers.get('x-device-id')
  if (headerDeviceId) return headerDeviceId

  // Body-based device ID
  if (body?.device_id) return body.device_id
  if (body?.device) return body.device // VMark format

  return null
}

// Normalize telemetry data from different protocols
function normalizeTelemetry(
  data: any,
  protocol: string,
  _deviceType?: string
): Record<string, unknown> {
  // VMark protocol format
  if (protocol === 'mqtt' && data.handle && data.paras) {
    return {
      ...data.paras,
      protocol_meta: {
        handle: data.handle,
        device: data.device,
        time: data.time,
        product: data.product,
        service: data.service,
      },
    }
  }

  // Standard telemetry format
  if (data.data) {
    return {
      ...data.data,
      protocol_meta: {
        timestamp: data.timestamp,
        protocol: protocol,
      },
    }
  }

  // Raw data format
  return {
    ...data,
    protocol_meta: {
      protocol: protocol,
      timestamp: new Date().toISOString(),
    },
  }
}

// Main Edge Function — uses service_role key to bypass RLS for device telemetry
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (request: Request): Promise<Response> => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only allow POST requests for telemetry
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Only POST method allowed for telemetry ingestion' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Create service-role Supabase client (bypasses RLS — required for unauthenticated device telemetry)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

    try {
      // Parse request
      const protocol = detectProtocol(request)
      let body: any = {}

      const contentType = request.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        body = await request.json()
      } else if (contentType?.includes('application/cbor')) {
        // Handle CBOR for CoAP - decode binary data
        const arrayBuffer = await request.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)

        // Simple CBOR-like decoding for common IoT telemetry patterns
        try {
          // For now, treat as binary telemetry data with basic structure detection
          if (uint8Array.length >= 4) {
            // Attempt to extract timestamp and values from binary data
            const timestamp = Date.now() // Use current time as fallback
            body = {
              timestamp,
              data: Array.from(uint8Array),
              format: 'cbor_binary',
              // Extract potential sensor values from binary patterns
              values: extractBinaryValues(uint8Array),
            }
          } else {
            body = { error: 'Invalid CBOR data length' }
          }
        } catch (_error) {
          body = {
            error: 'CBOR decode failed',
            raw_data: Array.from(uint8Array),
          }
        }
      }

      const deviceId = extractDeviceId(request, body, protocol)

      if (!deviceId) {
        return createErrorResponse('Device ID not found in request', 400)
      }

      // Telemetry received and processed

      // Find device in database
      const { data: device, error: deviceError } = await supabase
        .from('devices')
        .select(
          `
        *,
        device_integrations!inner(
          id,
          integration_type,
          settings
        )
      `
        )
        .eq('hardware_id', deviceId)
        .eq('device_integrations.integration_type', 'netneural_hub')
        .single()

      if (deviceError || !device) {
        console.warn(`[NetNeuralHub] Device not found: ${deviceId}`)
        return createErrorResponse(
          'Device not registered in NetNeural Hub',
          404
        )
      }

      // Normalize telemetry data
      const telemetryData = normalizeTelemetry(
        body,
        protocol,
        device.device_type
      )

      // Store telemetry in database
      const { error: telemetryError } = await supabase
        .from('device_telemetry')
        .insert({
          id: crypto.randomUUID(), // Explicit UUID to avoid caching bug
          device_id: device.id,
          data: telemetryData,
          received_at: new Date().toISOString(),
          protocol: protocol,
        })

      if (telemetryError) {
        console.error(
          `[NetNeuralHub] Failed to store telemetry for ${deviceId}:`,
          telemetryError
        )
        return createErrorResponse('Failed to store telemetry', 500)
      }

      // Update device last_seen
      await supabase
        .from('devices')
        .update({
          last_seen: new Date().toISOString(),
          status: 'online',
        })
        .eq('id', device.id)

      // Check for alerts (temperature thresholds, etc.)
      await checkDeviceAlerts(supabase, device, telemetryData)

      // Telemetry processed successfully

      return createSuccessResponse({
        message: 'Telemetry received and processed',
        device_id: deviceId,
        protocol: protocol,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('[NetNeuralHub] Telemetry processing error:', error)
      return createErrorResponse(
        error instanceof Error ? error.message : 'Unknown error',
        500
      )
    }
  },
  {
    requireAuth: false, // Allow unauthenticated device telemetry
    allowedMethods: ['POST'],
    corsEnabled: true,
  }
)

// Alert processing function
async function checkDeviceAlerts(
  supabase: any,
  device: any,
  telemetryData: Record<string, unknown>
): Promise<void> {
  try {
    // Get alert rules for this device
    const { data: alertRules } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('device_id', device.id)
      .eq('enabled', true)

    if (!alertRules?.length) return

    // Check each alert rule
    for (const rule of alertRules) {
      const { field, operator, threshold, alert_type } = rule
      const value = telemetryData[field]

      if (value === undefined || value === null) continue

      let triggered = false

      switch (operator) {
        case 'greater_than':
          triggered = Number(value) > Number(threshold)
          break
        case 'less_than':
          triggered = Number(value) < Number(threshold)
          break
        case 'equals':
          triggered = String(value) === String(threshold)
          break
        case 'not_equals':
          triggered = String(value) !== String(threshold)
          break
      }

      if (triggered) {
        // Create alert
        await supabase.from('alerts').insert({
          id: crypto.randomUUID(), // Explicit UUID to avoid caching bug
          device_id: device.id,
          alert_rule_id: rule.id,
          type: alert_type,
          severity: rule.severity || 'medium',
          message: `${field} ${operator} ${threshold} (current: ${value})`,
          data: {
            field,
            current_value: value,
            threshold,
            operator,
            telemetry_snapshot: telemetryData,
          },
          created_at: new Date().toISOString(),
        })

        console.log(
          `[NetNeuralHub] 🚨 Alert triggered for ${device.name}: ${field} ${operator} ${threshold}`
        )
      }
    }
  } catch (error) {
    console.error('[NetNeuralHub] Alert checking failed:', error)
  }
}
