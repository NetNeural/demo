// ===========================================================================
// Integration Webhook Handler - Unified
// ===========================================================================
// Receives and processes webhook events from any IoT platform
// Supports: Golioth, AWS IoT, Azure IoT Hub, MQTT brokers
// Features: Signature verification, event processing, real-time updates
// ===========================================================================

import { createEdgeFunction, createSuccessResponse, DatabaseError } from '../_shared/request-handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface WebhookPayload {
  event: string
  timestamp: string
  data: {
    deviceId: string
    status?: string
    lastSeen?: string
    metadata?: Record<string, unknown>
    [key: string]: unknown
  }
}

export default createEdgeFunction(async ({ req }) => {
  // Get webhook signature and integration ID from headers
  // Header format varies by provider:
  // - Golioth: X-Golioth-Signature
  // - AWS IoT: X-Amz-Sns-Message-Id
  // - Azure: X-Azure-Signature
  const signature = req.headers.get('X-Golioth-Signature') || 
                   req.headers.get('X-Amz-Sns-Message-Id') ||
                   req.headers.get('X-Azure-Signature') ||
                   req.headers.get('X-Webhook-Signature')
  const integrationId = req.headers.get('X-Integration-ID')
  const body = await req.text()
  
  if (!signature) {
    throw new DatabaseError('Missing signature', 401)
  }

  if (!integrationId) {
    throw new Error('Missing integration ID')
  }

  // Initialize Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

    // Get integration and verify webhook is enabled
    const { data: integration, error: intError } = await supabase
      .from('device_integrations')
      .select('*')
      .eq('id', integrationId)
    .eq('webhook_enabled', true)
    .single()

  if (intError || !integration) {
    throw new Error('Webhook not configured')
  }

  // Verify signature
  if (integration.webhook_secret) {
    const expectedSignature = await generateSignature(body, integration.webhook_secret)
    if (signature !== expectedSignature) {
      throw new DatabaseError('Invalid signature', 401)
    }
  }

  // Parse payload
  const payload: WebhookPayload = JSON.parse(body)
  
  // Log webhook event to integration_sync_log (renamed from golioth_sync_log)
  // @ts-expect-error - Insert object not fully typed in generated types
  await supabase.from('integration_sync_log').insert({
    organization_id: integration.organization_id,
    integration_id: integrationId,
    operation: 'webhook',
    status: 'processing',
    details: { 
      event: payload.event, 
      deviceId: payload.data.deviceId,
      providerType: integration.type 
    },
  })

  // Handle different event types
  // Event names are normalized across providers:
  // - Golioth: device.updated, device.created, device.deleted, device.status_changed
  // - AWS IoT: Uses SNS notifications, not direct webhooks (subscribe to SNS topics)
  // - Azure IoT Hub: Uses Event Grid, not direct webhooks (subscribe to Event Grid)
  // - MQTT: Custom implementation via broker events
  switch (payload.event) {
    case 'device.updated':
      await handleDeviceUpdate(supabase, integration, payload)
      break
    case 'device.created':
      await handleDeviceCreate(supabase, integration, payload)
      break
    case 'device.deleted':
      await handleDeviceDelete(supabase, payload)
      break
    case 'device.status_changed':
      await handleStatusChange(supabase, payload)
      break
    default:
      console.log('Unknown event type:', payload.event, 'from provider:', integration.type)
  }

  // Update sync log status
  // @ts-expect-error - Update object not fully typed in generated types
  await supabase
    .from('integration_sync_log')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('integration_id', integrationId)
    .eq('operation', 'webhook')
    .order('created_at', { ascending: false })
    .limit(1)

  return createSuccessResponse({ message: 'OK' })
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
  payload: WebhookPayload
) {
  const { data: device } = await supabase
    .from('devices')
    .select('*')
    .eq('external_device_id', payload.data.deviceId)
    .eq('organization_id', integration.organization_id)
    .maybeSingle()

  if (device) {
    // @ts-expect-error - Update object not fully typed in generated types
    await supabase
      .from('devices')
      .update({
        status: payload.data.status || device.status,
        last_seen: payload.data.lastSeen || device.last_seen,
        metadata: payload.data.metadata || device.metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', device.id)
  }
}

// deno-lint-ignore no-explicit-any
async function handleDeviceCreate(
  // deno-lint-ignore no-explicit-any
  supabase: any, 
  // deno-lint-ignore no-explicit-any
  integration: any, 
  payload: WebhookPayload
) {
  const { data: existing } = await supabase
    .from('devices')
    .select('id')
    .eq('external_device_id', payload.data.deviceId)
    .eq('organization_id', integration.organization_id)
    .maybeSingle()

  if (!existing) {
    // Queue for import
    // @ts-expect-error - Insert object not fully typed in generated types
    await supabase.from('sync_queue').insert({
      organization_id: integration.organization_id,
      integration_id: integration.id,
      operation: 'sync_device',
      priority: 8,
      payload: { deviceId: payload.data.deviceId },
    })
  }
}

// deno-lint-ignore no-explicit-any
async function handleDeviceDelete(
  // deno-lint-ignore no-explicit-any
  supabase: any, 
  payload: WebhookPayload
) {
  // @ts-expect-error - Update object not fully typed in generated types
  await supabase
    .from('devices')
    .update({ 
      status: 'offline', 
      updated_at: new Date().toISOString() 
    })
    .eq('external_device_id', payload.data.deviceId)
}

// deno-lint-ignore no-explicit-any
async function handleStatusChange(
  // deno-lint-ignore no-explicit-any
  supabase: any, 
  payload: WebhookPayload
) {
  // @ts-expect-error - Update object not fully typed in generated types
  await supabase
    .from('devices')
    .update({ 
      status: payload.data.status,
      last_seen: new Date().toISOString() 
    })
    .eq('external_device_id', payload.data.deviceId)
}
