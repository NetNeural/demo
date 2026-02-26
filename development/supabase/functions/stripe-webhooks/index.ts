/**
 * Edge Function: stripe-webhooks
 * Handles Stripe webhook events and updates the local database.
 *
 * Events handled:
 *   - checkout.session.completed  → create subscription row
 *   - invoice.paid               → insert invoice, update sub period
 *   - invoice.payment_failed     → mark sub past_due
 *   - customer.subscription.updated → sync status / period
 *   - customer.subscription.deleted → mark canceled
 *
 * Security:
 *   - Verifies stripe-signature header
 *   - Idempotent via Stripe event ID (processed_stripe_events table)
 *   - Uses service role client (bypasses RLS)
 *
 * #241: Stripe Integration
 */

import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import { corsHeaders } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/auth.ts'

// ── Stripe singleton ──────────────────────────────────────────────────
function getStripe(): Stripe {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new Error('STRIPE_SECRET_KEY not set')
  return new Stripe(key, {
    apiVersion: '2024-04-10',
    httpClient: Stripe.createFetchHttpClient(),
  })
}

// ── Main handler ───────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonError('POST only', 405)
  }

  const stripe = getStripe()
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set')
    return jsonError('Webhook secret not configured', 500)
  }

  // ── Verify signature ─────────────────────────────────────────────────
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return jsonError('Missing stripe-signature header', 400)
  }

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return jsonError('Invalid signature', 400)
  }

  // ── Idempotency check ────────────────────────────────────────────────
  const db = createServiceClient()
  const { data: existing } = await db
    .from('processed_stripe_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle()

  if (existing) {
    console.log(`Event ${event.id} already processed — skipping`)
    return jsonOk({ received: true, duplicate: true })
  }

  // ── Route event ──────────────────────────────────────────────────────
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session, stripe, db)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice, db)
        break

      case 'invoice.payment_failed':
        await handleInvoiceFailed(event.data.object as Stripe.Invoice, db)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, db)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, db)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // Mark event processed
    await db
      .from('processed_stripe_events')
      .insert({ stripe_event_id: event.id, event_type: event.type })

    return jsonOk({ received: true })
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err)
    return jsonError('Webhook handler error', 500)
  }
})

// ═══════════════════════════════════════════════════════════════════════
// Event Handlers
// ═══════════════════════════════════════════════════════════════════════

/**
 * checkout.session.completed
 * Customer just finished Stripe Checkout → create/update subscription row
 */
async function handleCheckoutComplete(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
  db: ReturnType<typeof createServiceClient>
) {
  const orgId = session.metadata?.organization_id
  const planId = session.metadata?.plan_id
  if (!orgId || !planId) {
    console.warn('checkout.session.completed missing metadata', session.id)
    return
  }

  // Retrieve the full subscription for period dates
  const stripeSubId = session.subscription as string
  const sub = await stripe.subscriptions.retrieve(stripeSubId)
  const customerId = typeof session.customer === 'string'
    ? session.customer
    : (session.customer as Stripe.Customer)?.id

  // Upsert subscription
  await db
    .from('subscriptions')
    .upsert(
      {
        organization_id: orgId,
        plan_id: planId,
        stripe_subscription_id: stripeSubId,
        stripe_customer_id: customerId || null,
        status: mapSubscriptionStatus(sub.status),
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' }
    )

  // Store customer ID on the org for portal use
  if (customerId) {
    await db
      .from('organizations')
      .update({ stripe_customer_id: customerId })
      .eq('id', orgId)
  }

  console.log(`✓ Subscription created for org ${orgId}, plan ${planId}`)
}

/**
 * invoice.paid → insert invoice record, update subscription period
 */
async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  db: ReturnType<typeof createServiceClient>
) {
  const stripeSubId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : (invoice.subscription as Stripe.Subscription)?.id

  // Find our subscription row
  let orgId: string | null = null
  let subId: string | null = null

  if (stripeSubId) {
    const { data: sub } = await db
      .from('subscriptions')
      .select('id, organization_id')
      .eq('stripe_subscription_id', stripeSubId)
      .maybeSingle()

    if (sub) {
      orgId = sub.organization_id
      subId = sub.id
    }
  }

  if (!orgId) {
    console.warn('invoice.paid: cannot resolve org', invoice.id)
    return
  }

  // Insert invoice
  await db.from('invoices').upsert(
    {
      organization_id: orgId,
      subscription_id: subId,
      stripe_invoice_id: invoice.id,
      amount_cents: invoice.amount_paid ?? 0,
      currency: invoice.currency ?? 'usd',
      status: 'paid',
      invoice_url: invoice.hosted_invoice_url ?? null,
      pdf_url: invoice.invoice_pdf ?? null,
      period_start: invoice.period_start
        ? new Date(invoice.period_start * 1000).toISOString()
        : null,
      period_end: invoice.period_end
        ? new Date(invoice.period_end * 1000).toISOString()
        : null,
    },
    { onConflict: 'stripe_invoice_id' }
  )

  // Update subscription period
  if (stripeSubId && invoice.period_start && invoice.period_end) {
    await db
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_start: new Date(invoice.period_start * 1000).toISOString(),
        current_period_end: new Date(invoice.period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', stripeSubId)
  }

  console.log(`✓ Invoice ${invoice.id} recorded (paid) for org ${orgId}`)
}

/**
 * invoice.payment_failed → mark subscription past_due
 */
async function handleInvoiceFailed(
  invoice: Stripe.Invoice,
  db: ReturnType<typeof createServiceClient>
) {
  const stripeSubId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : (invoice.subscription as Stripe.Subscription)?.id

  if (!stripeSubId) return

  await db
    .from('subscriptions')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', stripeSubId)

  console.log(`⚠ Subscription ${stripeSubId} marked past_due (payment failed)`)
}

/**
 * customer.subscription.updated → sync status, period, cancel flag
 */
async function handleSubscriptionUpdated(
  sub: Stripe.Subscription,
  db: ReturnType<typeof createServiceClient>
) {
  const planIdFromMeta = sub.metadata?.plan_id
  const updatePayload: Record<string, unknown> = {
    status: mapSubscriptionStatus(sub.status),
    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }

  // If plan changed via Stripe dashboard, update plan_id
  if (planIdFromMeta) {
    updatePayload.plan_id = planIdFromMeta
  }

  await db
    .from('subscriptions')
    .update(updatePayload)
    .eq('stripe_subscription_id', sub.id)

  console.log(`✓ Subscription ${sub.id} synced — status=${sub.status}`)
}

/**
 * customer.subscription.deleted → mark canceled
 */
async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
  db: ReturnType<typeof createServiceClient>
) {
  await db
    .from('subscriptions')
    .update({
      status: 'canceled',
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', sub.id)

  console.log(`✓ Subscription ${sub.id} canceled`)
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

/**
 * Map Stripe subscription status to our enum
 */
function mapSubscriptionStatus(
  status: Stripe.Subscription.Status
): 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete' {
  switch (status) {
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
    case 'unpaid':
      return 'canceled'
    case 'trialing':
      return 'trialing'
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
    default:
      return 'incomplete'
  }
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
