// ===========================================================================
// Golioth Webhook Handler - Production Grade
// ===========================================================================
// Receives and processes webhook events from Golioth platform
// Features: Signature verification, event processing, real-time updates
// ===========================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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

serve(async (req) => {
  try {
    // Verify webhook signature
    const signature = req.headers.get('X-Golioth-Signature')
    const integrationId = req.headers.get('X-Integration-ID')
    const body = await req.text()
    
    if (!signature) {
      return new Response('Missing signature', { status: 401 })
    }

    if (!integrationId) {
      return new Response('Missing integration ID', { status: 400 })
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
      return new Response('Webhook not configured', { status: 400 })
    }

    // Verify signature
    if (integration.webhook_secret) {
      const expectedSignature = await generateSignature(body, integration.webhook_secret)
      if (signature !== expectedSignature) {
        return new Response('Invalid signature', { status: 401 })
      }
    }

    // Parse payload
    const payload: WebhookPayload = JSON.parse(body)
    
    // Log webhook event
    await supabase.from('golioth_sync_log').insert({
      organization_id: integration.organization_id,
      integration_id: integrationId,
      operation: 'webhook',
      status: 'processing',
      details: { event: payload.event, deviceId: payload.data.deviceId },
    })

    // Handle different event types
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
        console.log('Unknown event type:', payload.event)
    }

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(error.message, { status: 500 })
  }
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

async function handleDeviceUpdate(supabase: any, integration: any, payload: WebhookPayload) {
  const { data: device } = await supabase
    .from('devices')
    .select('*')
    .eq('external_device_id', payload.data.deviceId)
    .eq('organization_id', integration.organization_id)
    .maybeSingle()

  if (device) {
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

async function handleDeviceCreate(supabase: any, integration: any, payload: WebhookPayload) {
  const { data: existing } = await supabase
    .from('devices')
    .select('id')
    .eq('external_device_id', payload.data.deviceId)
    .eq('organization_id', integration.organization_id)
    .maybeSingle()

  if (!existing) {
    // Queue for import
    await supabase.from('sync_queue').insert({
      organization_id: integration.organization_id,
      integration_id: integration.id,
      operation: 'sync_device',
      priority: 8,
      payload: { deviceId: payload.data.deviceId },
    })
  }
}

async function handleDeviceDelete(supabase: any, payload: WebhookPayload) {
  await supabase
    .from('devices')
    .update({ 
      status: 'offline', 
      updated_at: new Date().toISOString() 
    })
    .eq('external_device_id', payload.data.deviceId)
}

async function handleStatusChange(supabase: any, payload: WebhookPayload) {
  await supabase
    .from('devices')
    .update({ 
      status: payload.data.status,
      last_seen: new Date().toISOString() 
    })
    .eq('external_device_id', payload.data.deviceId)
}
