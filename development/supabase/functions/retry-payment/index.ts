/**
 * Edge Function: retry-payment
 * Retries a failed Stripe payment intent.
 *
 * POST /retry-payment
 *   body: { paymentId: string }
 *   returns: { success: boolean, message: string }
 *
 * Security:
 * - Caller must have canManageBilling permission (org owner or billing role)
 * - Rate limited: max 3 retries per payment per 24h
 *
 * #55: Payment history with retry mechanism
 */

import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import {
  createEdgeFunction,
  createSuccessResponse,
  createErrorResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createServiceClient, getUserContext } from '../_shared/auth.ts'

const MAX_RETRIES_24H = 3

export default createEdgeFunction(
  async ({ req }) => {
    if (req.method !== 'POST') {
      return createErrorResponse('POST only', 405)
    }

    // ── Auth & permissions ─────────────────────────────────────────────
    const userContext = await getUserContext(req)
    if (!userContext.organizationId) {
      throw new DatabaseError('User has no organization', 400)
    }

    // Must be org owner, billing role, or super admin
    if (
      userContext.role !== 'super_admin' &&
      userContext.role !== 'org_owner'
    ) {
      // Check if user has billing role in org
      const db = createServiceClient()
      const { data: membership } = await db
        .from('organization_members')
        .select('role')
        .eq('user_id', userContext.userId)
        .eq('organization_id', userContext.organizationId)
        .single()

      if (!membership || !['owner', 'billing'].includes(membership.role)) {
        throw new DatabaseError(
          'You do not have permission to retry payments',
          403
        )
      }
    }

    // ── Parse body ─────────────────────────────────────────────────────
    const body = await req.json()
    const { paymentId } = body

    if (!paymentId) {
      throw new DatabaseError('paymentId is required', 400)
    }

    // ── Stripe init ────────────────────────────────────────────────────
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new DatabaseError('Stripe is not configured', 500)
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-04-10',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // ── Load payment record ────────────────────────────────────────────
    const db = createServiceClient()

    const { data: payment, error: paymentErr } = await db
      .from('payment_history')
      .select('*')
      .eq('id', paymentId)
      .eq('organization_id', userContext.organizationId)
      .single()

    if (paymentErr || !payment) {
      throw new DatabaseError('Payment record not found', 404)
    }

    if (payment.status !== 'failed') {
      throw new DatabaseError(
        `Cannot retry a payment with status "${payment.status}"`,
        400
      )
    }

    if (!payment.stripe_payment_intent) {
      throw new DatabaseError(
        'No Stripe payment intent associated with this payment',
        400
      )
    }

    // ── Rate limit check ───────────────────────────────────────────────
    if (payment.retry_count >= MAX_RETRIES_24H && payment.last_retry_at) {
      const lastRetry = new Date(payment.last_retry_at)
      const now = new Date()
      const hoursSince =
        (now.getTime() - lastRetry.getTime()) / (1000 * 60 * 60)

      if (hoursSince < 24) {
        throw new DatabaseError(
          `Retry limit reached (${MAX_RETRIES_24H} per 24h). Try again in ${Math.ceil(24 - hoursSince)} hours.`,
          429
        )
      }

      // Reset counter after 24h window
      await db
        .from('payment_history')
        .update({ retry_count: 0 })
        .eq('id', paymentId)
    }

    // ── Attempt Stripe retry ───────────────────────────────────────────
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(
        payment.stripe_payment_intent
      )

      // Update payment record
      const newStatus =
        paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending'

      await db
        .from('payment_history')
        .update({
          status: newStatus,
          retry_count: (payment.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
          failure_code: null,
          failure_message: null,
        })
        .eq('id', paymentId)

      // If succeeded, also update the invoice status
      if (newStatus === 'succeeded' && payment.invoice_id) {
        await db
          .from('invoices')
          .update({ status: 'paid' })
          .eq('id', payment.invoice_id)
      }

      return createSuccessResponse({
        success: true,
        message:
          newStatus === 'succeeded'
            ? 'Payment successful!'
            : 'Payment retry initiated. Status will update shortly.',
        status: newStatus,
      })
    } catch (stripeErr: any) {
      // Stripe error — update the record with failure details
      const failureCode = stripeErr?.code ?? stripeErr?.decline_code ?? 'unknown'
      const failureMessage =
        stripeErr?.message ?? 'Payment retry failed. Please try again later.'

      await db
        .from('payment_history')
        .update({
          retry_count: (payment.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
          failure_code: failureCode,
          failure_message: failureMessage,
        })
        .eq('id', paymentId)

      return createErrorResponse(failureMessage, 402)
    }
  },
  { requireAuth: true }
)
