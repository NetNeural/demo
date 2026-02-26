-- #243: Create subscriptions and invoices tables
-- Stripe webhook handler writes to these; billing dashboard reads from them
-- Depends on: billing_plans (#242)

-- ============================================================================
-- Enum Types
-- ============================================================================
CREATE TYPE public.subscription_status AS ENUM (
  'active',
  'past_due',
  'canceled',
  'trialing',
  'incomplete'
);

CREATE TYPE public.invoice_status AS ENUM (
  'draft',
  'open',
  'paid',
  'void',
  'uncollectible'
);

-- ============================================================================
-- Table: subscriptions
-- One subscription per organization (1:1 relationship)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id                 UUID NOT NULL REFERENCES public.billing_plans(id) ON DELETE RESTRICT,
  stripe_subscription_id  TEXT UNIQUE,
  stripe_customer_id      TEXT,                               -- allows portal link generation
  status                  public.subscription_status NOT NULL DEFAULT 'active',
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comment
COMMENT ON TABLE public.subscriptions IS 'Organization billing subscriptions linked to Stripe. One per org.';
COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS 'Stripe Customer ID — enables Customer Portal link without modifying organizations table.';
COMMENT ON COLUMN public.subscriptions.cancel_at_period_end IS 'When true, subscription will not renew. Set by Stripe webhook on cancellation.';

-- ============================================================================
-- Table: invoices
-- Append-only — never update, only insert from Stripe webhooks
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id     UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id   TEXT UNIQUE,
  amount_cents        INTEGER NOT NULL DEFAULT 0,              -- in cents (e.g., 2900 = $29.00)
  currency            TEXT NOT NULL DEFAULT 'usd',
  status              public.invoice_status NOT NULL DEFAULT 'draft',
  invoice_url         TEXT,                                     -- Stripe hosted invoice page
  pdf_url             TEXT,                                     -- downloadable PDF link
  period_start        TIMESTAMPTZ,
  period_end          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comment
COMMENT ON TABLE public.invoices IS 'Invoice records from Stripe webhooks. Append-only — never update existing rows.';
COMMENT ON COLUMN public.invoices.amount_cents IS 'Invoice total in smallest currency unit (cents for USD).';

-- ============================================================================
-- Indexes
-- ============================================================================

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_organization
  ON public.subscriptions(organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id
  ON public.subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
  ON public.subscriptions(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions(status);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_organization
  ON public.invoices(organization_id);

CREATE INDEX IF NOT EXISTS idx_invoices_subscription
  ON public.invoices(subscription_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id
  ON public.invoices(stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON public.invoices(status);

CREATE INDEX IF NOT EXISTS idx_invoices_created
  ON public.invoices(created_at DESC);

-- ============================================================================
-- Updated_at trigger (subscriptions only — invoices are append-only)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subscriptions_updated_at();

-- ============================================================================
-- Row Level Security: subscriptions
-- ============================================================================
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Org members can read their own organization's subscription
CREATE POLICY "Org members can read own subscription"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Service role has full access (Stripe webhooks write via service_role)
CREATE POLICY "Service role full access on subscriptions"
  ON public.subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Row Level Security: invoices
-- ============================================================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Org members can read their own organization's invoices
CREATE POLICY "Org members can read own invoices"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Service role has full access (Stripe webhooks insert invoices)
CREATE POLICY "Service role full access on invoices"
  ON public.invoices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Constraint: one active subscription per organization
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_active_per_org
  ON public.subscriptions(organization_id)
  WHERE status IN ('active', 'trialing', 'past_due');
