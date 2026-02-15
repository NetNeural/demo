// ===========================================================================
// Integration Webhook Handler - Unified
// ===========================================================================
// Receives and processes webhook events from any IoT platform
// Supports: Golioth, AWS IoT, Azure IoT Hub, MQTT brokers
// Features: Signature verification, event processing, real-time updates
// ===========================================================================

import { createEdgeFunction, createSuccessResponse, DatabaseError } from '../_shared/request-handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { mapWebhookPayload, type RawWebhookPayload, type NormalizedWebhookPayload } from '../_shared/webhook-mappers.ts'

type SupabaseClient = ReturnType<typeof createClient>

export default createEdgeFunction(async ({ req }) => {
  let activityLogId: string | null = null
  let integrationId: string | null = null
  let supabase: any = null
  
  try {
    // Get webhook signature and integration ID from headers
    // Header format varies by provider:
    // - Golioth: X-Golioth-Signature
    // - AWS IoT: X-Amz-Sns-Message-Id
    // - Azure: X-Azure-Signature
    // - Custom: X-Webhook-Signature
    const signature = req.headers.get('X-Golioth-Signature') || 
                     req.headers.get('X-Amz-Sns-Message-Id') ||
                     req.headers.get('X-Azure-Signature') ||
                     req.headers.get('X-Webhook-Signature')
    integrationId = req.headers.get('X-Integration-ID')
    const body = await req.text()
    
    if (!integrationId) {
      throw new DatabaseError('Missing integration ID', 400)
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    supabase = createClient(supabaseUrl, supabaseKey)

      // Get integration and verify webhook is enabled
      const { data: integration, error: intError } = await supabase
        .from('device_integrations')
        .select('*')
        .eq('id', integrationId)
      .eq('webhook_enabled', true)
      .single()

    if (intError || !integration) {
      throw new DatabaseError('Webhook not configured', 404)
    }

    // Verify signature if secret is configured (non-blocking - log verification result)
    let signatureVerification = 'not_required'
    if (integration.webhook_secret) {
      if (!signature) {
        signatureVerification = 'missing_signature'
      } else {
        const expectedSignature = await generateSignature(body, integration.webhook_secret)
        if (signature !== expectedSignature) {
          signatureVerification = 'verification_failed'
        } else {
          signatureVerification = 'verified'
        }
      }
    }

  // Parse and normalize payload
  const rawPayload: RawWebhookPayload = JSON.parse(body)
  const normalized = mapWebhookPayload(integration.integration_type, rawPayload)
  
  // Log webhook event to integration_activity_log
  const { data: activityLog, error: logError } = await supabase.from('integration_activity_log').insert({
      integration_id: integrationId,
      organization_id: integration.organization_id,
      activity_type: 'webhook_received',
      direction: 'incoming',
      status: 'started',
      method: 'POST',
      endpoint: '/functions/v1/integration-webhook',
      request_headers: {
        'X-Integration-ID': integrationId,
        'X-Golioth-Signature': signature ? '***' : null,
      },
      request_body: rawPayload,
      error_message: signatureVerification !== 'verified' && signatureVerification !== 'not_required' 
        ? `Signature verification: ${signatureVerification}` 
        : null,
      metadata: {
        signature_verification: signatureVerification
      }
  }).select('id').single()
  
  if (logError) {
    console.error('[Webhook] Failed to create activity log:', logError)
  }
  
  activityLogId = activityLog?.id || null
  
  // Log webhook event to integration_sync_log (legacy table)
  await supabase.from('integration_sync_log').insert({
    organization_id: integration.organization_id,
    integration_id: integrationId,
    operation: 'webhook',
    status: 'processing',
    details: { 
      event: normalized.event, 
      deviceId: normalized.deviceId,
      providerType: integration.integration_type 
    },
  })

  // Handle different event types
  // Event names are normalized across providers:
  // - Golioth: device.updated, device.created, device.deleted, device.status_changed
  // - AWS IoT: Uses SNS notifications, not direct webhooks (subscribe to SNS topics)
  // - Azure IoT Hub: Uses Event Grid, not direct webhooks (subscribe to Event Grid)
  // - MQTT: Custom implementation via broker events
  switch (normalized.event) {
    case 'device.updated':
      await handleDeviceUpdate(supabase, integration, normalized)
      break
    case 'device.created':
      await handleDeviceCreate(supabase, integration, normalized)
      break
    case 'device.deleted':
      await handleDeviceDelete(supabase, normalized)
      break
    case 'device.status_changed':
    case 'device.online':
    case 'device.offline':
      await handleStatusChange(supabase, integration, normalized)
      break
    case 'device.telemetry':
    case 'device.data':
      // Telemetry events - treat as device update with new data
      await handleDeviceUpdate(supabase, integration, normalized)
      break
    default:
      console.log('Unknown event type:', normalized.event, 'from provider:', integration.type)
  }

  // Update activity log status to completed
  if (activityLogId) {
    await supabase
      .from('integration_activity_log')
      .update({ 
        status: 'success',
        response_status: 200,
        response_body: {
          success: true,
          event: normalized.event,
          deviceId: normalized.deviceId || normalized.deviceName,
          deviceName: normalized.deviceName,
        },
        error_message: null,
      })
      .eq('id', activityLogId)
  }

  // Update sync log status (legacy)
  // Update sync log status (legacy)
  await supabase
    .from('integration_sync_log')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('integration_id', integrationId)
    .eq('operation', 'webhook')
    .order('created_at', { ascending: false })
    .limit(1)

  return createSuccessResponse({ 
    success: true, 
    message: 'Webhook processed successfully' 
  })
  } catch (error) {
    // Log error to activity log if we have the necessary context
    if (supabase && integrationId && activityLogId) {
      await supabase
        .from('integration_activity_log')
        .update({ 
          status: 'failed',
          response_status: error instanceof DatabaseError ? error.status : 500,
          response_body: {
            error: error instanceof Error ? error.message : String(error),
          },
          error_message: error instanceof Error ? error.message : 'Webhook processing failed',
        })
        .eq('id', activityLogId)
        .catch(console.error) // Don't fail if logging fails
    }
    
    // Re-throw the error to be handled by the edge function error handler
    throw error
  }
}, {
  requireAuth: false,  // Webhooks from external services don't send auth headers
  allowedMethods: ['POST']
})

async function generateSignature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body)
  )
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// deno-lint-ignore no-explicit-any
async function handleDeviceUpdate(
  // deno-lint-ignore no-explicit-any
  supabase: any, 
  // deno-lint-ignore no-explicit-any
  integration: any, 
  payload: NormalizedWebhookPayload
) {
  if (!payload.deviceId) {
    console.error('[Webhook] No device ID found in payload')
    return
  }
  
  // Look up device by serial_number first (primary), then external_device_id (fallback)
  // Golioth device_name maps to serial_number in NetNeural devices table
  let query = supabase
    .from('devices')
    .select('*')
    .eq('organization_id', integration.organization_id)
  
  if (payload.deviceName) {
    query = query.eq('serial_number', payload.deviceName)
  } else {
    query = query.eq('external_device_id', payload.deviceId)
  }
  
  const { data: device } = await query.maybeSingle()

  if (device) {
    // Update existing device
    const updateData: Record<string, unknown> = {
      status: payload.status || device.status,
      last_seen: payload.lastSeen || new Date().toISOString(),
      metadata: payload.metadata || device.metadata,
      updated_at: new Date().toISOString(),
    }
    
    // Update external_device_id and serial_number if not set
    if (!device.external_device_id && payload.deviceId) {
      updateData.external_device_id = payload.deviceId
    }
    if (!device.serial_number && payload.deviceName) {
      updateData.serial_number = payload.deviceName
    }
    
    await supabase
      .from('devices')
      .update(updateData)
      .eq('id', device.id)
    
    console.log('[Webhook] Updated device:', device.id, 'with serial:', payload.deviceName)
    
    // Store telemetry data if present in payload
    if (payload.metadata?.telemetry) {
      const telemetryData = payload.metadata.telemetry as Record<string, unknown>
      await supabase.rpc('record_device_telemetry', {
        p_device_id: device.id,
        p_telemetry_data: telemetryData,
        p_timestamp: payload.timestamp || new Date().toISOString(),
      }).catch((err: Error) => {
        console.error('[Webhook] Failed to record telemetry:', err)
      })
    }
  } else {
    // Create new device if it doesn't exist (upsert behavior)
    const { data: newDevice, error } = await supabase
      .from('devices')
      .insert({
        organization_id: integration.organization_id,
        integration_id: integration.id,
        external_device_id: payload.deviceId,
        serial_number: payload.deviceName,
        name: payload.deviceName || payload.deviceId,
        device_type: 'iot-sensor',  // Default type for webhook-created devices
        status: payload.status || 'online',
        last_seen: payload.lastSeen || new Date().toISOString(),
        metadata: payload.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (error) {
      console.error('[Webhook] Failed to create device:', error)
    } else {
      console.log('[Webhook] Created new device:', newDevice?.id, 'for serial:', payload.deviceName)
      
      // Store telemetry data if present
      if (newDevice && payload.metadata?.telemetry) {
        const telemetryData = payload.metadata.telemetry as Record<string, unknown>
        await supabase.rpc('record_device_telemetry', {
          p_device_id: newDevice.id,
          p_telemetry_data: telemetryData,
          p_timestamp: payload.timestamp || new Date().toISOString(),
        }).catch((err: Error) => {
          console.error('[Webhook] Failed to record telemetry:', err)
        })
      }
    }
  }
}

// deno-lint-ignore no-explicit-any
async function handleDeviceCreate(
  // deno-lint-ignore no-explicit-any
  supabase: any, 
  // deno-lint-ignore no-explicit-any
  integration: any, 
  payload: NormalizedWebhookPayload
) {
  if (!payload.deviceId) {
    console.error('[Webhook] No device ID found in payload')
    return
  }
  
  // Look up device by serial_number first (primary), then external_device_id (fallback)
  let query = supabase
    .from('devices')
    .select('id')
    .eq('organization_id', integration.organization_id)
  
  if (payload.deviceName) {
    query = query.eq('serial_number', payload.deviceName)
  } else {
    query = query.eq('external_device_id', payload.deviceId)
  }
  
  const { data: existing } = await query.maybeSingle()

  if (!existing) {
    // For custom webhooks, create device directly
    // For platform integrations (golioth, aws_iot, etc), queue for sync to fetch full details
    if (integration.integration_type === 'custom_webhook' || integration.integration_type === 'webhook') {
      const { data: newDevice, error } = await supabase
        .from('devices')
        .insert({
          organization_id: integration.organization_id,
          integration_id: integration.id,
          external_device_id: payload.deviceId,
          serial_number: payload.deviceName,
          name: payload.deviceName || payload.deviceId,
          device_type: 'iot-sensor',
          status: payload.status || 'unknown',
          last_seen: payload.lastSeen || new Date().toISOString(),
          metadata: payload.metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()
      
      if (error) {
        console.error('[Webhook] Failed to create device:', error)
      } else {
        console.log('[Webhook] Created new device:', newDevice?.id)
      }
    } else {
      // Queue for import from platform API to get full device details
      await supabase.from('sync_queue').insert({
        organization_id: integration.organization_id,
        integration_id: integration.id,
        operation: 'sync_device',
        priority: 8,
        payload: { deviceId: payload.deviceId, deviceName: payload.deviceName },
      })
      console.log('[Webhook] Queued device for sync:', payload.deviceId)
    }
  }
}

// deno-lint-ignore no-explicit-any
async function handleDeviceDelete(
  // deno-lint-ignore no-explicit-any
  supabase: any, 
  payload: NormalizedWebhookPayload
) {
  await supabase
    .from('devices')
    .update({ 
      status: 'offline', 
      updated_at: new Date().toISOString() 
    })
    .eq('external_device_id', payload.deviceId)
}

// deno-lint-ignore no-explicit-any
async function handleStatusChange(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  // deno-lint-ignore no-explicit-any
  integration: any, 
  payload: NormalizedWebhookPayload
) {
  if (!payload.deviceId) {
    console.error('[Webhook] No device ID found in payload')
    return
  }
  
  // Look up device by serial_number first (primary), then external_device_id (fallback)
  let query = supabase
    .from('devices')
    .select('id')
    .eq('organization_id', integration.organization_id)
  
  if (payload.deviceName) {
    query = query.eq('serial_number', payload.deviceName)
  } else {
    query = query.eq('external_device_id', payload.deviceId)
  }
  
  const { data: device } = await query.maybeSingle()
  
  if (device) {
    // Update existing device status
    await supabase
      .from('devices')
      .update({ 
        status: payload.status,
        last_seen: new Date().toISOString() 
      })
      .eq('id', device.id)
    
    console.log('[Webhook] Updated device status:', device.id)
  } else if (integration.integration_type === 'custom_webhook' || integration.integration_type === 'webhook') {
    // Create device if it doesn't exist (for custom webhooks)
    const { data: newDevice, error } = await supabase
      .from('devices')
      .insert({
        organization_id: integration.organization_id,
        integration_id: integration.id,
        external_device_id: payload.deviceId,
        serial_number: payload.deviceName,
        name: payload.deviceName || payload.deviceId,
        device_type: 'iot-sensor',  // Default type for webhook-created devices
        status: payload.status || 'unknown',
        last_seen: new Date().toISOString(),
        metadata: payload.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (error) {
      console.error('[Webhook] Failed to create device:', error)
    } else {
      console.log('[Webhook] Created new device from status change:', newDevice?.id)
    }
  }
}
