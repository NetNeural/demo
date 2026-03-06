/**
 * Edge Function: stripe-checkout
 * Creates a Stripe Checkout session for plan upgrades / new subscriptions.
 *
 * POST /stripe-checkout
 *   body: { planId: string, billingInterval: 'monthly' | 'annual', sensorCount?: number }
 *   returns: { url: string } — redirect the user to this URL
 *
 * #241: Stripe Integration
 */

import {
  createEdgeFunction,
  createSuccessResponse,
  createErrorResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createServiceClient, getUserContext } from '../_shared/auth.ts'
import { getBillingStripe, pickPriceId } from '../_shared/stripe.ts'

export default createEdgeFunction(
  async ({ req }) => {
    if (req.method !== 'POST') {
      return createErrorResponse('POST only', 405)
    }

    const userContext = await getUserContext(req)
    if (!userContext.organizationId) {
      throw new DatabaseError('User has no organization', 400)
    }

    const body = await req.json()
    const { planId, billingInterval = 'monthly', sensorCount = 1 } = body

    if (!planId) {
      throw new DatabaseError('planId is required', 400)
    }

    // ── Stripe init (billing-mode aware) ────────────────────────────────
    const db = createServiceClient()
    const billingConfig = await getBillingStripe(db)
    const stripe = billingConfig.stripe

    // ── Load plan from DB ──────────────────────────────────────────

    const { data: plan, error: planErr } = await db
      .from('billing_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (planErr || !plan) {
      throw new DatabaseError('Plan not found', 404)
    }

    const priceId = pickPriceId(plan, billingConfig, billingInterval as 'monthly' | 'annual')

    // ── Get or create Stripe Customer ──────────────────────────────────
    const { data: org } = await db
      .from('organizations')
      .select('id, name, stripe_customer_id')
      .eq('id', userContext.organizationId)
      .single()

    if (!org) {
      throw new DatabaseError('Organization not found', 404)
    }

    let customerId = org.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        email: userContext.email,
        metadata: {
          organization_id: org.id,
          created_by: userContext.userId,
        },
      })
      customerId = customer.id

      // Persist on org record for portal re-use
      await db
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', org.id)
    }

    // ── Create Checkout Session ────────────────────────────────────────
    // Per-device pricing: quantity = sensorCount
    const origin =
      Deno.env.get('SITE_URL') ||
      Deno.env.get('NEXT_PUBLIC_SITE_URL') ||
      'https://sentinel.netneural.ai'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: Math.max(1, Math.round(sensorCount)),
        },
      ],
      subscription_data: {
        metadata: {
          organization_id: org.id,
          plan_id: planId,
          sensor_count: String(sensorCount),
        },
      },
      success_url: `${origin}/dashboard/organizations?tab=billing&checkout=success`,
      cancel_url: `${origin}/pricing?checkout=canceled`,
      metadata: {
        organization_id: org.id,
        plan_id: planId,
      },
    })

    return createSuccessResponse(
      { url: session.url },
      { message: 'Checkout session created' }
    )
  },
  { requireAuth: true, allowedMethods: ['POST', 'OPTIONS'] }
)
