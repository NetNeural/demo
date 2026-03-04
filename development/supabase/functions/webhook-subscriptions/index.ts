/**
 * Webhook Subscriptions Edge Function (#388)
 *
 * Manages outbound webhook subscriptions for an organisation.
 * When events occur (e.g. alert.created), NetNeural POSTs a signed payload
 * to all active URLs subscribed to that event type.
 *
 * Routes:
 *   GET    /webhook-subscriptions?organization_id=...          — list subscriptions
 *   GET    /webhook-subscriptions?organization_id=...&id=...   — single sub + recent delivery log
 *   POST   /webhook-subscriptions                              — create subscription
 *   PATCH  /webhook-subscriptions?id=...                       — update subscription
 *   DELETE /webhook-subscriptions?id=...                       — delete subscription
 *   POST   /webhook-subscriptions?id=...&action=test           — send test ping
 */
import {
  createEdgeFunction,
  createSuccessResponse,
} from '../_shared/request-handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { getUserContext } from '../_shared/auth.ts'
import { deliverWebhook } from '../_shared/webhook-delivery.ts'

// Supported event types for webhook subscriptions
const SUPPORTED_EVENTS = [
  'alert.created',
  'alert.resolved',
  'device.online',
  'device.offline',
  'device.warning',
]

/** Generate a random HMAC signing secret (hex, 32 bytes) */
function generateSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default createEdgeFunction(
  async ({ req }) => {
    const userContext = await getUserContext(req)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const url = new URL(req.url)
    const method = req.method
    const organizationId = url.searchParams.get('organization_id')
    const subId = url.searchParams.get('id')
    const action = url.searchParams.get('action')

    const isPlatformAdmin = userContext.isPlatformAdmin

    // Verify user is admin/owner of the target org
    async function assertOrgAdmin(orgId: string) {
      if (isPlatformAdmin) return
      const { data: member } = await supabaseAdmin
        .from('organization_members')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', userContext.userId)
        .single()
      if (!member || !['owner', 'admin'].includes(member.role)) {
        throw new Error('You must be an org admin to manage webhooks')
      }
    }

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (method === 'GET') {
      if (!organizationId) throw new Error('organization_id is required')
      await assertOrgAdmin(organizationId)

      if (subId) {
        // Single subscription + delivery log
        const { data: sub, error: subErr } = await supabaseAdmin
          .from('webhook_subscriptions')
          .select('*')
          .eq('id', subId)
          .eq('organization_id', organizationId)
          .single()
        if (subErr || !sub) throw new Error('Webhook subscription not found')

        const { data: deliveries } = await supabaseAdmin
          .from('webhook_delivery_log')
          .select('id, event_type, response_status, success, duration_ms, delivered_at')
          .eq('subscription_id', subId)
          .order('delivered_at', { ascending: false })
          .limit(50)

        return createSuccessResponse({ subscription: sub, recent_deliveries: deliveries ?? [] })
      }

      const { data: subs, error } = await supabaseAdmin
        .from('webhook_subscriptions')
        .select('id, name, url, event_types, is_active, last_triggered_at, last_status_code, failure_count, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return createSuccessResponse({ subscriptions: subs ?? [] })
    }

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (method === 'POST' && !action) {
      const body = await req.json()
      const { organization_id, name, url: webhookUrl, event_types } = body

      const orgId = organization_id || organizationId
      if (!orgId) throw new Error('organization_id is required')
      await assertOrgAdmin(orgId)

      // Validate URL
      try { new URL(webhookUrl) } catch { throw new Error('Invalid webhook URL') }
      if (!webhookUrl.startsWith('https://')) throw new Error('Webhook URL must use HTTPS')

      // Validate event_types
      const invalidEvents = (event_types || []).filter((e: string) => !SUPPORTED_EVENTS.includes(e))
      if (invalidEvents.length > 0) {
        throw new Error(`Unsupported event types: ${invalidEvents.join(', ')}. Supported: ${SUPPORTED_EVENTS.join(', ')}`)
      }
      if (!event_types || event_types.length === 0) throw new Error('At least one event_type is required')

      const secret = generateSecret()

      const { data: sub, error } = await supabaseAdmin
        .from('webhook_subscriptions')
        .insert({
          organization_id: orgId,
          name: name || webhookUrl,
          url: webhookUrl,
          secret,
          event_types,
          is_active: true,
          created_by: userContext.userId,
        })
        .select()
        .single()

      if (error) throw error

      // Send test ping (fire and forget)
      deliverWebhook(supabaseAdmin, sub.id, sub.url, secret, 'ping', {
        message: 'Webhook subscription created. This is a test ping.',
        subscription_id: sub.id,
      }).catch(() => {})

      // Return the secret only once at creation time
      return createSuccessResponse({ subscription: { ...sub, secret } }, 201)
    }

    // ── TEST PING ─────────────────────────────────────────────────────────────
    if (method === 'POST' && action === 'test') {
      if (!subId) throw new Error('id is required for test action')

      const resolvedOrgId = organizationId || ''
      await assertOrgAdmin(resolvedOrgId)

      const { data: sub, error } = await supabaseAdmin
        .from('webhook_subscriptions')
        .select('*')
        .eq('id', subId)
        .single()
      if (error || !sub) throw new Error('Webhook subscription not found')

      await deliverWebhook(supabaseAdmin, sub.id, sub.url, sub.secret, 'ping', {
        message: 'Manual test ping from NetNeural',
        subscription_id: sub.id,
      })

      return createSuccessResponse({ message: 'Test ping delivered', subscription_id: sub.id })
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────
    if (method === 'PATCH') {
      if (!subId) throw new Error('id is required')

      const body = await req.json()
      const { name, url: webhookUrl, event_types, is_active } = body

      // Get existing to confirm org
      const { data: existing } = await supabaseAdmin
        .from('webhook_subscriptions')
        .select('organization_id')
        .eq('id', subId)
        .single()
      if (!existing) throw new Error('Webhook subscription not found')
      await assertOrgAdmin(existing.organization_id)

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (name !== undefined) updates.name = name
      if (is_active !== undefined) updates.is_active = is_active
      if (webhookUrl !== undefined) {
        try { new URL(webhookUrl) } catch { throw new Error('Invalid webhook URL') }
        if (!webhookUrl.startsWith('https://')) throw new Error('Webhook URL must use HTTPS')
        updates.url = webhookUrl
      }
      if (event_types !== undefined) {
        const invalid = event_types.filter((e: string) => !SUPPORTED_EVENTS.includes(e))
        if (invalid.length > 0) throw new Error(`Unsupported event types: ${invalid.join(', ')}`)
        if (event_types.length === 0) throw new Error('At least one event_type is required')
        updates.event_types = event_types
      }

      const { data: updated, error } = await supabaseAdmin
        .from('webhook_subscriptions')
        .update(updates)
        .eq('id', subId)
        .select()
        .single()

      if (error) throw error
      return createSuccessResponse({ subscription: updated })
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (method === 'DELETE') {
      if (!subId) throw new Error('id is required')

      const { data: existing } = await supabaseAdmin
        .from('webhook_subscriptions')
        .select('organization_id')
        .eq('id', subId)
        .single()
      if (!existing) throw new Error('Webhook subscription not found')
      await assertOrgAdmin(existing.organization_id)

      const { error } = await supabaseAdmin
        .from('webhook_subscriptions')
        .delete()
        .eq('id', subId)

      if (error) throw error
      return createSuccessResponse({ message: 'Webhook subscription deleted' })
    }

    throw new Error(`Method ${method} not allowed`)
  }
)
