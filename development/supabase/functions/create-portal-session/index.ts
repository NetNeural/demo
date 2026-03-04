/**
 * Edge Function: create-portal-session
 * Creates a Stripe Customer Portal session for self-service billing management.
 *
 * POST /create-portal-session
 *   body: { organizationId: string }
 *   returns: { url: string } — redirect the user to this URL
 *
 * The portal lets customers:
 *   - Update payment method
 *   - View invoices
 *   - Cancel / reactivate subscription
 *   - Switch plans (if configured in Stripe Dashboard)
 *
 * #241: Stripe Integration
 */

import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import {
  createEdgeFunction,
  createSuccessResponse,
  createErrorResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createServiceClient, getUserContext } from '../_shared/auth.ts'

export default createEdgeFunction(
  async ({ req }) => {
    if (req.method !== 'POST') {
      return createErrorResponse('POST only', 405)
    }

    const userContext = await getUserContext(req)
    const body = await req.json()
    const organizationId = body.organizationId || userContext.organizationId
    const returnPath = body.returnPath || '/dashboard/organizations?tab=billing'

    if (!organizationId) {
      throw new DatabaseError('organizationId is required', 400)
    }

    // ── Stripe init ──────────────────────────────────────────────────
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new DatabaseError('Stripe is not configured', 500)
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-04-10',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // ── Look up customer ID ──────────────────────────────────────────
    const db = createServiceClient()

    const { data: org } = await db
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single()

    const customerId = org?.stripe_customer_id

    if (!customerId) {
      // Fallback: check subscriptions table
      const { data: sub } = await db
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('organization_id', organizationId)
        .not('stripe_customer_id', 'is', null)
        .limit(1)
        .maybeSingle()

      if (!sub?.stripe_customer_id) {
        throw new DatabaseError(
          'No Stripe customer found for this organization. Please subscribe to a plan first.',
          404
        )
      }

      // Backfill org record
      await db
        .from('organizations')
        .update({ stripe_customer_id: sub.stripe_customer_id })
        .eq('id', organizationId)

      return await createPortalSession(stripe, sub.stripe_customer_id, returnPath)
    }

    return await createPortalSession(stripe, customerId, returnPath)
  },
  { requireAuth: true, allowedMethods: ['POST', 'OPTIONS'] }
)

async function createPortalSession(stripe: Stripe, customerId: string, returnPath: string) {
  const origin =
    Deno.env.get('SITE_URL') ||
    Deno.env.get('NEXT_PUBLIC_SITE_URL') ||
    'https://sentinel.netneural.ai'

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}${returnPath}`,
  })

  return createSuccessResponse(
    { url: session.url },
    { message: 'Portal session created' }
  )
}
