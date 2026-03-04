/**
 * Shared webhook delivery helper (#388)
 * Delivers a signed webhook event to a subscriber URL and logs the result.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

/** HMAC-SHA256 signature for payload verification */
export async function hmacSign(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return 'sha256=' + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Deliver a webhook event to a single subscription.
 * Logs the delivery attempt to `webhook_delivery_log` and
 * updates `webhook_subscriptions.last_status_code`.
 *
 * This function never throws — call it fire-and-forget if desired.
 */
export async function deliverWebhook(
  supabaseAdmin: ReturnType<typeof createClient>,
  subscriptionId: string,
  subscriptionUrl: string,
  secret: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; statusCode: number; durationMs: number }> {
  const body = JSON.stringify({
    event: eventType,
    timestamp: new Date().toISOString(),
    data: payload,
  })
  const signature = await hmacSign(secret, body)

  const started = Date.now()
  let responseStatus = 0
  let success = false

  try {
    const resp = await fetch(subscriptionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-NetNeural-Event': eventType,
        'X-NetNeural-Signature': signature,
        'X-NetNeural-Delivery': crypto.randomUUID(),
        'User-Agent': 'NetNeural-Webhooks/1.0',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    responseStatus = resp.status
    success = resp.status >= 200 && resp.status < 300
  } catch (err) {
    console.warn(`[webhook-delivery] Failed to deliver to ${subscriptionUrl}:`, err)
    responseStatus = 0
    success = false
  }

  const durationMs = Date.now() - started

  try {
    // Log delivery result
    await supabaseAdmin.from('webhook_delivery_log').insert({
      subscription_id: subscriptionId,
      event_type: eventType,
      payload,
      response_status: responseStatus,
      duration_ms: durationMs,
      success,
    })

    // Update subscription stats
    const updateData: Record<string, unknown> = {
      last_triggered_at: new Date().toISOString(),
      last_status_code: responseStatus,
    }
    if (!success) {
      // Increment failure_count by reading current value
      const { data: sub } = await supabaseAdmin
        .from('webhook_subscriptions')
        .select('failure_count')
        .eq('id', subscriptionId)
        .single()
      updateData.failure_count = ((sub?.failure_count ?? 0) as number) + 1
    } else {
      updateData.failure_count = 0
    }

    await supabaseAdmin
      .from('webhook_subscriptions')
      .update(updateData)
      .eq('id', subscriptionId)
  } catch (err) {
    console.warn('[webhook-delivery] Failed to log delivery:', err)
  }

  return { success, statusCode: responseStatus, durationMs }
}

/**
 * Dispatch a webhook event to all active subscriptions for an organisation
 * that subscribe to `eventType`.
 *
 * Call this fire-and-forget — it never throws.
 */
export async function dispatchWebhookEvent(
  organizationId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase    = createClient(supabaseUrl, serviceKey)

    const { data: subs, error } = await supabase
      .from('webhook_subscriptions')
      .select('id, url, secret')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .contains('event_types', [eventType])

    if (error || !subs?.length) return

    await Promise.allSettled(
      subs.map(sub =>
        deliverWebhook(supabase, sub.id, sub.url, sub.secret, eventType, payload)
      )
    )
  } catch (err) {
    console.warn('[webhook-delivery] dispatchWebhookEvent error:', err)
  }
}
