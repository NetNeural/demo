// ===========================================================================
// Integration Webhook Handler - Unified
// ===========================================================================
// Receives and processes webhook events from any IoT platform
// Supports: Golioth, AWS IoT, Azure IoT Hub, MQTT brokers
// Features: Signature verification, event processing, real-time updates
// ===========================================================================

import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  mapWebhookPayload,
  type RawWebhookPayload,
  type NormalizedWebhookPayload,
} from '../_shared/webhook-mappers.ts'

type SupabaseClient = ReturnType<typeof createClient>

export default createEdgeFunction(
  async ({ req }) => {
    let activityLogId: string | null = null
    let integrationId: string | null = null
    let supabase: any = null

    try {
      // Get webhook signature and integration ID from headers
      // Header format varies by provider:
      // - Golioth: X-Golioth-Signature (not implemented by platform, kept for future compatibility)
      // - AWS IoT: X-Amz-Sns-Message-Id
      // - Azure: X-Azure-Signature
      // - Custom: X-Webhook-Signature
      const signature =
        req.headers.get('X-Golioth-Signature') ||
        req.headers.get('X-Amz-Sns-Message-Id') ||
        req.headers.get('X-Azure-Signature') ||
        req.headers.get('X-Webhook-Signature')

      // Support integration ID from header, URL query param, or auto-detect
      const url = new URL(req.url)
      integrationId =
        req.headers.get('X-Integration-ID') ||
        url.searchParams.get('integration_id')
      const body = await req.text()

      // Initialize Supabase
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      supabase = createClient(supabaseUrl, supabaseKey)

      // If no integration ID provided, try to auto-detect from the payload
      if (!integrationId) {
        const rawPayload = JSON.parse(body)
        // Golioth telemetry events have device_name and telemetry at top level
        if (rawPayload.device_name || rawPayload.telemetry) {
          const { data: goliothIntegration } = await supabase
            .from('device_integrations')
            .select('id')
            .eq('integration_type', 'golioth')
            .eq('webhook_enabled', true)
            .limit(1)
            .maybeSingle()

          if (goliothIntegration) {
            integrationId = goliothIntegration.id
            console.log(
              '[Webhook] Auto-detected Golioth integration:',
              integrationId
            )
          }
        }
      }

      if (!integrationId) {
        throw new DatabaseError('Missing integration ID', 400)
      }

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
      // NOTE: Golioth webhooks do not support HMAC signature generation (platform limitation)
      let signatureVerification = 'not_required'
      const isGolioth = integration.integration_type === 'golioth'

      if (integration.webhook_secret && !isGolioth) {
        // Only verify signatures for platforms that support them (AWS, Azure, Custom)
        if (!signature) {
          signatureVerification = 'missing_signature'
          console.warn(
            '[Webhook] No signature header found. Configure webhook with:'
          )
          console.warn(
            '  - Signature Header: X-Webhook-Signature (or platform-specific header)'
          )
          console.warn('  - Signature Algorithm: HMAC-SHA256')
          console.warn('  - Secret:', integration.webhook_secret)
        } else {
          const expectedSignature = await generateSignature(
            body,
            integration.webhook_secret
          )
          if (signature !== expectedSignature) {
            signatureVerification = 'verification_failed'
            console.error('[Webhook] Signature verification failed!')
            console.error('  Received signature:', signature)
            console.error('  Expected signature:', expectedSignature)
          } else {
            signatureVerification = 'verified'
            console.log('[Webhook] Signature verified successfully')
          }
        }
      } else if (isGolioth) {
        signatureVerification = 'not_supported'
        console.log(
          '[Webhook] Golioth webhooks do not support signature verification (platform limitation)'
        )
      }

      // Parse and normalize payload
      const rawPayload: RawWebhookPayload = JSON.parse(body)
      const normalized = mapWebhookPayload(
        integration.integration_type,
        rawPayload
      )

      // Log webhook event to integration_activity_log
      const { data: activityLog, error: logError } = await supabase
        .from('integration_activity_log')
        .insert({
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
          error_message:
            signatureVerification !== 'verified' &&
            signatureVerification !== 'not_required'
              ? `Signature verification: ${signatureVerification}`
              : null,
          metadata: {
            signature_verification: signatureVerification,
          },
        })
        .select('id')
        .single()

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
          providerType: integration.integration_type,
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
          // Telemetry events - store telemetry data and update device
          await handleTelemetry(
            supabase,
            integration,
            normalized,
            activityLogId
          )
          break
        default:
          console.log(
            'Unknown event type:',
            normalized.event,
            'from provider:',
            integration.type
          )
      }

      // Build response with device information
      const responseBody = {
        success: true,
        event: normalized.event,
        deviceId: normalized.deviceId || normalized.deviceName || '',
        deviceName: normalized.deviceName || '',
        message: 'Webhook processed successfully',
      }

      // Update activity log status to completed
      if (activityLogId) {
        await supabase
          .from('integration_activity_log')
          .update({
            status: 'success',
            response_status: 200,
            response_body: responseBody,
            error_message: null,
          })
          .eq('id', activityLogId)
      }

      // Update sync log status (legacy)
      await supabase
        .from('integration_sync_log')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('integration_id', integrationId)
        .eq('operation', 'webhook')
        .order('created_at', { ascending: false })
        .limit(1)

      return createSuccessResponse(responseBody)
    } catch (error) {
      // Log error to activity log if we have the necessary context
      if (supabase && integrationId && activityLogId) {
        await supabase
          .from('integration_activity_log')
          .update({
            status: 'failed',
            response_status:
              error instanceof DatabaseError ? error.status : 500,
            response_body: {
              error: error instanceof Error ? error.message : String(error),
            },
            error_message:
              error instanceof Error
                ? error.message
                : 'Webhook processing failed',
          })
          .eq('id', activityLogId)
          .catch(console.error) // Don't fail if logging fails
      }

      // Re-throw the error to be handled by the edge function error handler
      throw error
    }
  },
  {
    requireAuth: false, // Webhooks from external services don't send auth headers
    allowedMethods: ['POST'],
  }
)

async function generateSignature(
  body: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
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

  // Look up device with cross-org fallback for transferred devices
  // First try org-scoped, then fall back to cross-org lookup
  let query = supabase
    .from('devices')
    .select('*')
    .eq('organization_id', integration.organization_id)

  // Search by both serial_number and external_device_id using OR condition
  if (payload.deviceName && payload.deviceId) {
    query = query.or(
      `serial_number.eq.${payload.deviceName},external_device_id.eq.${payload.deviceId}`
    )
  } else if (payload.deviceName) {
    query = query.eq('serial_number', payload.deviceName)
  } else if (payload.deviceId) {
    query = query.eq('external_device_id', payload.deviceId)
  }

  let { data: device } = await query.maybeSingle()
  let crossOrg = false

  // Cross-org fallback for transferred devices
  if (!device) {
    let fallbackQuery = supabase.from('devices').select('*')

    if (payload.deviceName && payload.deviceId) {
      fallbackQuery = fallbackQuery.or(
        `serial_number.eq.${payload.deviceName},external_device_id.eq.${payload.deviceId}`
      )
    } else if (payload.deviceName) {
      fallbackQuery = fallbackQuery.eq('serial_number', payload.deviceName)
    } else if (payload.deviceId) {
      fallbackQuery = fallbackQuery.eq('external_device_id', payload.deviceId)
    }

    const { data: crossOrgDevice } = await fallbackQuery.maybeSingle()
    if (crossOrgDevice) {
      device = crossOrgDevice
      crossOrg = true
      console.log(
        '[Webhook] Device status change - cross-org fallback:',
        crossOrgDevice.id,
        '| Device org:',
        crossOrgDevice.organization_id,
        '| Integration org:',
        integration.organization_id
      )
    }
  }

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

    await supabase.from('devices').update(updateData).eq('id', device.id)

    console.log(
      '[Webhook] Updated device:',
      device.id,
      'with serial:',
      payload.deviceName,
      crossOrg ? '(cross-org fallback)' : ''
    )

    // Store telemetry data if present in payload
    // Use device's actual org for telemetry storage if cross-org
    if (payload.metadata?.telemetry) {
      const effectiveIntegration = crossOrg
        ? { ...integration, organization_id: device.organization_id }
        : integration
      await storeTelemetry(supabase, device.id, effectiveIntegration, payload, null)
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
        device_type: 'iot-sensor', // Default type for webhook-created devices
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
      console.log(
        '[Webhook] Created new device:',
        newDevice?.id,
        'for serial:',
        payload.deviceName
      )

      // Store telemetry data if present
      if (newDevice && payload.metadata?.telemetry) {
        await storeTelemetry(supabase, newDevice.id, integration, payload, null)
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
  // Use OR condition to check both fields and avoid duplicates
  let query = supabase
    .from('devices')
    .select('id')
    .eq('organization_id', integration.organization_id)

  // Search by both serial_number and external_device_id using OR condition
  if (payload.deviceName && payload.deviceId) {
    query = query.or(
      `serial_number.eq.${payload.deviceName},external_device_id.eq.${payload.deviceId}`
    )
  } else if (payload.deviceName) {
    query = query.eq('serial_number', payload.deviceName)
  } else if (payload.deviceId) {
    query = query.eq('external_device_id', payload.deviceId)
  }

  let { data: existing } = await query.maybeSingle()

  // Cross-org fallback: don't create duplicates for transferred devices
  if (!existing) {
    let fallbackQuery = supabase.from('devices').select('id')

    if (payload.deviceName && payload.deviceId) {
      fallbackQuery = fallbackQuery.or(
        `serial_number.eq.${payload.deviceName},external_device_id.eq.${payload.deviceId}`
      )
    } else if (payload.deviceName) {
      fallbackQuery = fallbackQuery.eq('serial_number', payload.deviceName)
    } else if (payload.deviceId) {
      fallbackQuery = fallbackQuery.eq('external_device_id', payload.deviceId)
    }

    const { data: crossOrgDevice } = await fallbackQuery.maybeSingle()
    if (crossOrgDevice) {
      existing = crossOrgDevice
      console.log(
        '[Webhook] Device create skipped - device exists in another org:',
        crossOrgDevice.id
      )
    }
  }

  if (!existing) {
    // For custom webhooks, create device directly
    // For platform integrations (golioth, aws_iot, etc), queue for sync to fetch full details
    if (
      integration.integration_type === 'custom_webhook' ||
      integration.integration_type === 'webhook'
    ) {
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

// ===========================================================================
// Telemetry Storage Helper
// ===========================================================================
// Directly inserts telemetry into device_telemetry_history table
async function storeTelemetry(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  deviceId: string,
  // deno-lint-ignore no-explicit-any
  integration: any,
  payload: NormalizedWebhookPayload,
  activityLogId: string | null
) {
  const telemetry = payload.metadata?.telemetry as Record<string, unknown>
  if (!telemetry) return

  const { error } = await supabase.from('device_telemetry_history').insert({
    device_id: deviceId,
    organization_id: integration.organization_id,
    integration_id: integration.id,
    telemetry: telemetry,
    received_at: new Date().toISOString(),
    device_timestamp:
      (telemetry.timestamp as string) || payload.timestamp || null,
    activity_log_id: activityLogId,
  })

  if (error) {
    console.error('[Webhook] Failed to store telemetry:', error)
  } else {
    console.log(
      '[Webhook] Stored telemetry for device:',
      deviceId,
      'sensor:',
      telemetry.sensor || 'unknown'
    )
  }
}

// ===========================================================================
// Cross-Org Device Lookup Helper
// ===========================================================================
// When a device is transferred between orgs, webhooks from the old integration
// still arrive but the device now belongs to a different org. This helper does
// a fallback cross-org lookup by serial_number/external_device_id when the
// org-scoped lookup returns no results.
async function findDeviceCrossOrg(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  // deno-lint-ignore no-explicit-any
  integration: any,
  payload: NormalizedWebhookPayload
  // deno-lint-ignore no-explicit-any
): Promise<{ device: any; crossOrg: boolean }> {
  // 1. Try org-scoped lookup first (normal path)
  let query = supabase
    .from('devices')
    .select('*')
    .eq('organization_id', integration.organization_id)

  if (payload.deviceName) {
    query = query.eq('serial_number', payload.deviceName)
  } else if (payload.deviceId) {
    query = query.eq('external_device_id', payload.deviceId)
  }

  const { data: device } = await query.maybeSingle()
  if (device) return { device, crossOrg: false }

  // 2. Fallback: cross-org lookup for transferred devices
  let fallbackQuery = supabase.from('devices').select('*')

  if (payload.deviceName) {
    fallbackQuery = fallbackQuery.eq('serial_number', payload.deviceName)
  } else if (payload.deviceId) {
    fallbackQuery = fallbackQuery.eq('external_device_id', payload.deviceId)
  }

  const { data: crossOrgDevice } = await fallbackQuery.maybeSingle()
  if (crossOrgDevice) {
    console.log(
      '[Webhook] Device found via cross-org fallback:',
      crossOrgDevice.id,
      '| Device org:',
      crossOrgDevice.organization_id,
      '| Integration org:',
      integration.organization_id
    )
    return { device: crossOrgDevice, crossOrg: true }
  }

  return { device: null, crossOrg: false }
}

// ===========================================================================
// Telemetry Event Handler
// ===========================================================================
// Dedicated handler for device.telemetry and device.data events
async function handleTelemetry(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  // deno-lint-ignore no-explicit-any
  integration: any,
  payload: NormalizedWebhookPayload,
  activityLogId: string | null
) {
  if (!payload.deviceId && !payload.deviceName) {
    console.error('[Webhook] No device ID or name found in telemetry payload')
    return
  }

  // Look up device — with cross-org fallback for transferred devices
  const { device, crossOrg } = await findDeviceCrossOrg(
    supabase,
    integration,
    payload
  )

  if (device) {
    // Use the device's actual organization_id for telemetry storage
    // This handles the case where a device was transferred to a new org
    // but webhooks still arrive from the old org's integration
    const effectiveIntegration = crossOrg
      ? { ...integration, organization_id: device.organization_id }
      : integration

    // Update device last_seen
    await supabase
      .from('devices')
      .update({
        last_seen: payload.lastSeen || new Date().toISOString(),
        status: 'online',
        updated_at: new Date().toISOString(),
      })
      .eq('id', device.id)

    // Store the telemetry data
    await storeTelemetry(
      supabase,
      device.id,
      effectiveIntegration,
      payload,
      activityLogId
    )

    console.log(
      '[Webhook] Processed telemetry for device:',
      device.id,
      device.serial_number,
      crossOrg ? '(cross-org fallback)' : ''
    )
  } else {
    // Device not found in any org - create it under the integration's org
    const { data: newDevice, error } = await supabase
      .from('devices')
      .insert({
        organization_id: integration.organization_id,
        integration_id: integration.id,
        external_device_id: payload.deviceId,
        serial_number: payload.deviceName,
        name: payload.deviceName || payload.deviceId,
        device_type: 'iot-sensor',
        status: 'online',
        last_seen: payload.lastSeen || new Date().toISOString(),
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('[Webhook] Failed to create device for telemetry:', error)
    } else if (newDevice) {
      await storeTelemetry(
        supabase,
        newDevice.id,
        integration,
        payload,
        activityLogId
      )
      console.log(
        '[Webhook] Created device and stored telemetry:',
        newDevice.id
      )
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
      updated_at: new Date().toISOString(),
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

  // Look up device with cross-org fallback for transferred devices
  let query = supabase
    .from('devices')
    .select('id')
    .eq('organization_id', integration.organization_id)

  if (payload.deviceName) {
    query = query.eq('serial_number', payload.deviceName)
  } else {
    query = query.eq('external_device_id', payload.deviceId)
  }

  let { data: device } = await query.maybeSingle()

  // Cross-org fallback for transferred devices
  if (!device) {
    let fallbackQuery = supabase.from('devices').select('id')

    if (payload.deviceName) {
      fallbackQuery = fallbackQuery.eq('serial_number', payload.deviceName)
    } else {
      fallbackQuery = fallbackQuery.eq('external_device_id', payload.deviceId)
    }

    const { data: crossOrgDevice } = await fallbackQuery.maybeSingle()
    if (crossOrgDevice) {
      device = crossOrgDevice
      console.log(
        '[Webhook] Status change - cross-org fallback:',
        crossOrgDevice.id
      )
    }
  }

  if (device) {
    // Update existing device status
    await supabase
      .from('devices')
      .update({
        status: payload.status,
        last_seen: new Date().toISOString(),
      })
      .eq('id', device.id)

    console.log('[Webhook] Updated device status:', device.id)
  } else if (
    integration.integration_type === 'custom_webhook' ||
    integration.integration_type === 'webhook'
  ) {
    // Create device if it doesn't exist (for custom webhooks)
    const { data: newDevice, error } = await supabase
      .from('devices')
      .insert({
        organization_id: integration.organization_id,
        integration_id: integration.id,
        external_device_id: payload.deviceId,
        serial_number: payload.deviceName,
        name: payload.deviceName || payload.deviceId,
        device_type: 'iot-sensor', // Default type for webhook-created devices
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
      console.log(
        '[Webhook] Created new device from status change:',
        newDevice?.id
      )
    }
  }
}
