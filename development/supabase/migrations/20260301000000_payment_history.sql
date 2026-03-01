-- #55: Create payment_history table for tracking payment transactions
-- Stores individual payment attempts / charge events from Stripe webhooks
-- Depends on: invoices (#49), subscriptions (#49)

-- ============================================================================
-- Enum Type: payment_status
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM (
    'succeeded',
    'failed',
    'pending',
    'refunded',
    'requires_action'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Table: payment_history
-- Append-only — Stripe webhooks insert rows on charge events
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id            UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  stripe_payment_intent TEXT,                                   -- pi_xxx
  stripe_charge_id      TEXT,                                   -- ch_xxx
  amount_cents          INTEGER NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'usd',
  status                public.payment_status NOT NULL DEFAULT 'pending',
  payment_method_type   TEXT,                                   -- 'card', 'bank_transfer', etc.
  card_brand            TEXT,                                   -- 'visa', 'mastercard', 'amex', etc.
  card_last4            TEXT,                                   -- '4242'
  receipt_url           TEXT,                                   -- Stripe receipt URL
  failure_code          TEXT,                                   -- Stripe decline code
  failure_message       TEXT,                                   -- Human-readable failure reason
  retry_count           INTEGER NOT NULL DEFAULT 0,             -- Number of retry attempts
  last_retry_at         TIMESTAMPTZ,                            -- When last retry was attempted
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments
COMMENT ON TABLE public.payment_history IS 'Payment transaction records from Stripe webhooks. Append-only.';
COMMENT ON COLUMN public.payment_history.amount_cents IS 'Payment amount in smallest currency unit (cents for USD).';
COMMENT ON COLUMN public.payment_history.retry_count IS 'Number of times retry has been attempted. Capped at 3 per 24h.';

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_payment_history_organization
  ON public.payment_history(organization_id);

CREATE INDEX IF NOT EXISTS idx_payment_history_invoice
  ON public.payment_history(invoice_id);

CREATE INDEX IF NOT EXISTS idx_payment_history_status
  ON public.payment_history(status);

CREATE INDEX IF NOT EXISTS idx_payment_history_created
  ON public.payment_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_history_stripe_pi
  ON public.payment_history(stripe_payment_intent)
  WHERE stripe_payment_intent IS NOT NULL;

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Org members can read their own organization's payment history
DROP POLICY IF EXISTS "Org members can read own payments" ON public.payment_history;
CREATE POLICY "Org members can read own payments"
  ON public.payment_history
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Service role has full access (Stripe webhooks + retry function)
DROP POLICY IF EXISTS "Service role full access on payment_history" ON public.payment_history;
CREATE POLICY "Service role full access on payment_history"
  ON public.payment_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
