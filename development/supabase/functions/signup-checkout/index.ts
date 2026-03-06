// deno-lint-ignore-file
/// <reference lib="deno.window" />
/**
 * Edge Function: signup-checkout
 * Creates a Stripe Checkout session for a newly signed-up user.
 * Called from the signup page AFTER account + org provisioning,
 * so there is no user session — uses anon key auth like signup-provision.
 *
 * POST /signup-checkout
 *   body: { organizationId, planSlug, customerEmail, customerName, billingInterval? }
 *   returns: { url: string } — redirect the user to Stripe Checkout
 */

import { createServiceClient } from '../_shared/auth.ts'
import { makeCorsHeaders } from '../_shared/cors.ts'
import { getBillingStripe, pickPriceId } from '../_shared/stripe.ts'

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const { organizationId, planSlug, customerEmail, customerName, billingInterval = 'monthly' } = body

    if (!organizationId || !planSlug) {
      return new Response(
        JSON.stringify({ error: 'organizationId and planSlug are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const db = createServiceClient()

    // ── Stripe init (billing-mode aware) ─────────────────────────────
    const billingConfig = await getBillingStripe(db)
    const stripe = billingConfig.stripe

    // ── Look up plan by slug ─────────────────────────────────────────
    const { data: plan, error: planErr } = await db
      .from('billing_plans')
      .select('id, name, slug, stripe_price_id_monthly, stripe_price_id_annual, stripe_live_price_monthly, stripe_live_price_annual')
      .eq('slug', planSlug)
      .eq('is_active', true)
      .single()

    if (planErr || !plan) {
      return new Response(
        JSON.stringify({ error: 'Plan not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const priceId = pickPriceId(plan, billingConfig, billingInterval as 'monthly' | 'annual')

    // ── Look up organization ─────────────────────────────────────────
    const { data: org, error: orgErr } = await db
      .from('organizations')
      .select('id, name, stripe_customer_id')
      .eq('id', organizationId)
      .single()

    if (orgErr || !org) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Get or create Stripe Customer ────────────────────────────────
    let customerId = org.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: customerName || org.name,
        email: customerEmail || undefined,
        metadata: {
          organization_id: org.id,
          source: 'signup',
        },
      })
      customerId = customer.id

      await db
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', org.id)
    }

    // ── Create Checkout Session ──────────────────────────────────────
    const origin =
      Deno.env.get('SITE_URL') ||
      Deno.env.get('NEXT_PUBLIC_SITE_URL') ||
      'https://sentinel.netneural.ai'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: {
          organization_id: org.id,
          plan_id: plan.id,
          source: 'signup',
        },
      },
      success_url: `${origin}/auth/login?signup=complete`,
      cancel_url: `${origin}/auth/login?signup=payment-skipped`,
      metadata: {
        organization_id: org.id,
        plan_id: plan.id,
      },
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('signup-checkout error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: `Failed to create checkout session: ${message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
