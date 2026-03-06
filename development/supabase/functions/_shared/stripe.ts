/**
 * Shared Stripe utilities for billing-mode–aware key selection.
 *
 * Edge functions call `getBillingStripe(db)` to get a Stripe instance
 * initialised with the correct secret key (test or live) based on the
 * platform billing_mode setting stored on the root NetNeural organization.
 *
 * Billing modes (stored in organizations.settings.billing_mode):
 *   - 'off'     → billing disabled, no checkout allowed
 *   - 'testing' → use STRIPE_SECRET_KEY (test key)
 *   - 'live'    → use STRIPE_SECRET_KEY_LIVE (live key)
 *
 * Price columns:
 *   - testing → stripe_price_id_monthly / stripe_price_id_annual
 *   - live    → stripe_live_price_monthly / stripe_live_price_annual
 */

import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const ROOT_ORG_ID = '00000000-0000-0000-0000-000000000001'

export type BillingMode = 'off' | 'testing' | 'live'

export interface BillingStripeConfig {
  mode: BillingMode
  stripe: Stripe
  /** Column name for the monthly price ID in billing_plans */
  monthlyPriceCol: 'stripe_price_id_monthly' | 'stripe_live_price_monthly'
  /** Column name for the annual price ID in billing_plans */
  annualPriceCol: 'stripe_price_id_annual' | 'stripe_live_price_annual'
}

/**
 * Returns a Stripe instance and price-column names that match the current
 * billing mode.  Throws if billing is off or keys are missing.
 */
// deno-lint-ignore no-explicit-any
export async function getBillingStripe(db: SupabaseClient<any>): Promise<BillingStripeConfig> {
  // ── Read billing mode from root org ────────────────────────────────
  let billingMode: BillingMode = 'testing' // safe default

  const { data: rootOrg } = await db
    .from('organizations')
    .select('settings')
    .eq('id', ROOT_ORG_ID)
    .single()

  if (rootOrg?.settings) {
    const settings = rootOrg.settings as Record<string, unknown>
    const mode = settings.billing_mode as string
    if (mode === 'off' || mode === 'testing' || mode === 'live') {
      billingMode = mode
    }
  }

  if (billingMode === 'off') {
    throw new Error('Billing is currently disabled')
  }

  // ── Pick the right secret key ──────────────────────────────────────
  let stripeKey: string | undefined
  if (billingMode === 'live') {
    stripeKey = Deno.env.get('STRIPE_SECRET_KEY_LIVE')
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY_LIVE is not configured — cannot process live billing')
    }
  } else {
    stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2024-04-10',
    httpClient: Stripe.createFetchHttpClient(),
  })

  return {
    mode: billingMode,
    stripe,
    monthlyPriceCol: billingMode === 'live' ? 'stripe_live_price_monthly' : 'stripe_price_id_monthly',
    annualPriceCol: billingMode === 'live' ? 'stripe_live_price_annual' : 'stripe_price_id_annual',
  }
}

/**
 * Helper: pick the correct price ID from a plan row based on billing mode
 * and interval.
 */
export function pickPriceId(
  // deno-lint-ignore no-explicit-any
  plan: Record<string, any>,
  config: BillingStripeConfig,
  interval: 'monthly' | 'annual' = 'monthly',
): string {
  const col = interval === 'annual' ? config.annualPriceCol : config.monthlyPriceCol
  const priceId = plan[col]
  if (!priceId) {
    const modeName = config.mode === 'live' ? 'live' : 'test'
    throw new Error(
      `No ${modeName}-mode Stripe price configured for ${plan.name || plan.slug} (${interval})`
    )
  }
  return priceId as string
}
