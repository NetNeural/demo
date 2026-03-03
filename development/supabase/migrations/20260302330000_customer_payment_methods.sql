-- #381: Customer payment methods table
-- Mirrors Stripe's saved payment methods per organization.
-- Populated/updated by Stripe webhook handler on:
--   payment_method.attached, payment_method.detached, customer.updated
-- Used by BillingTab to display saved cards without calling Stripe API on every load.

CREATE TABLE IF NOT EXISTS public.customer_payment_methods (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Stripe identifiers
  stripe_payment_method_id  TEXT UNIQUE NOT NULL,   -- pm_xxx
  stripe_customer_id        TEXT,                   -- cus_xxx (for lookups)

  -- Card details (from Stripe's card object)
  card_brand          TEXT,         -- 'visa', 'mastercard', 'amex', 'discover', etc.
  card_last4          TEXT,         -- '4242'
  card_exp_month      INTEGER,      -- 1-12
  card_exp_year       INTEGER,      -- e.g. 2026
  card_fingerprint    TEXT,         -- Stripe fingerprint for dedup

  -- Wallet / payment method type
  payment_method_type TEXT NOT NULL DEFAULT 'card',  -- 'card', 'us_bank_account', etc.
  wallet_type         TEXT,         -- 'apple_pay', 'google_pay', null for regular card

  -- Status
  is_default          BOOLEAN NOT NULL DEFAULT false,
  is_active           BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  detached_at         TIMESTAMPTZ   -- set when Stripe fires payment_method.detached
);

COMMENT ON TABLE public.customer_payment_methods IS
  'Saved payment methods per organization, mirrored from Stripe via webhooks. '
  'Used for display in the billing dashboard without live Stripe API calls.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_org
  ON public.customer_payment_methods(organization_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_customer
  ON public.customer_payment_methods(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Enforce only one default payment method per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_default_per_org
  ON public.customer_payment_methods(organization_id)
  WHERE is_default = true AND is_active = true;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_payment_method_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_methods_updated_at ON public.customer_payment_methods;
CREATE TRIGGER trg_payment_methods_updated_at
  BEFORE UPDATE ON public.customer_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_payment_method_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.customer_payment_methods ENABLE ROW LEVEL SECURITY;

-- Org members can view their payment methods (read-only — mutations via Stripe portal/webhooks)
DROP POLICY IF EXISTS "Org members read own payment methods" ON public.customer_payment_methods;
CREATE POLICY "Org members read own payment methods"
  ON public.customer_payment_methods FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Super admins full read access
DROP POLICY IF EXISTS "Super admins read all payment methods" ON public.customer_payment_methods;
CREATE POLICY "Super admins read all payment methods"
  ON public.customer_payment_methods FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- Service role full access (webhooks insert/update/deactivate)
DROP POLICY IF EXISTS "Service role full access on payment methods" ON public.customer_payment_methods;
CREATE POLICY "Service role full access on payment methods"
  ON public.customer_payment_methods FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
