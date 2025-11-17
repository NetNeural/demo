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

    // Verify signature if secret is configured
    if (integration.webhook_secret) {
    if (!signature) {
      throw new DatabaseError('Missing signature', 401)
    }
    const expectedSignature = await generateSignature(body, integration.webhook_secret)
    if (signature !== expectedSignature) {
      throw new DatabaseError('Invalid signature', 401)
    }
  }

  // Parse and normalize payload
  const rawPayload: RawWebhookPayload = JSON.parse(body)
  const normalized = mapWebhookPayload(integration.integration_type, rawPayload)
  
  console.log('[Integration Webhook] Received event:', {
    event: normalized.event,
    integration_type: integration.integration_type,
    integration_id: integrationId,
    device_id: normalized.deviceId,
    payload_keys: Object.keys(rawPayload)
  })
  
    // Log webhook event to integration_activity_log
    const { data: activityLog } = await supabase.from('integration_activity_log').insert({
      integration_id: integrationId,
      organization_id: integration.organization_id,
      type: 'webhook',
      direction: 'incoming',
      status: 'processing',
      message: `Received ${normalized.event} event from ${integration.integration_type}`,
      metadata: { 
        event: normalized.event,
        deviceId: normalized.deviceId,
        integration_type: integration.integration_type,
        raw_payload: rawPayload
      },
    }).select('id').single()
    
    activityLogId = activityLog?.id || null  // Log webhook event to integration_sync_log (legacy table)
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
  if (activityLog?.id) {
    await supabase
      .from('integration_activity_log')
      .update({ 
        status: 'completed',
        message: `Successfully processed ${normalized.event} event`,
        metadata: {
          event: normalized.event,
          deviceId: normalized.deviceId,
          integration_type: integration.integration_type,
          processed_at: new Date().toISOString()
        }
      })
      .eq('id', activityLog.id)
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
          message: error instanceof Error ? error.message : 'Webhook processing failed',
          metadata: {
            error: error instanceof Error ? error.message : String(error),
            error_stack: error instanceof Error ? error.stack : undefined,
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', activityLogId)
        .catch(console.error) // Don't fail if logging fails
    }
    
    // Re-throw the error to be handled by the edge function error handler
    throw error
  }
}, {
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
  
  const { data: device } = await supabase
    .from('devices')
    .select('*')
    .eq('external_device_id', payload.deviceId)
    .eq('organization_id', integration.organization_id)
    .maybeSingle()

  if (device) {
    // Update existing device
    await supabase
      .from('devices')
      .update({
        status: payload.status || device.status,
        last_seen: payload.lastSeen || new Date().toISOString(),
        metadata: payload.metadata || device.metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', device.id)
    
    console.log('[Webhook] Updated device:', device.id)
  } else {
    // Create new device if it doesn't exist (upsert behavior)
    const { data: newDevice, error } = await supabase
      .from('devices')
      .insert({
        organization_id: integration.organization_id,
        integration_id: integration.id,
        external_device_id: payload.deviceId,
        name: payload.deviceName || payload.deviceId,
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
  
  const { data: existing } = await supabase
    .from('devices')
    .select('id')
    .eq('external_device_id', payload.deviceId)
    .eq('organization_id', integration.organization_id)
    .maybeSingle()

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
          name: payload.deviceName || payload.deviceId,
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
        payload: { deviceId: payload.deviceId },
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
  
  const { data: device } = await supabase
    .from('devices')
    .select('id')
    .eq('external_device_id', payload.deviceId)
    .eq('organization_id', integration.organization_id)
    .maybeSingle()
  
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
        name: payload.deviceName || payload.deviceId,
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
