-- #242: Create billing_plans table with tier definitions and resource limits
-- Foundation for Stripe checkout, plan comparison page, and usage metering

-- ============================================================================
-- Table: billing_plans
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  slug            TEXT NOT NULL UNIQUE,
  stripe_price_id_monthly TEXT,          -- Stripe Price ID for monthly billing
  stripe_price_id_annual  TEXT,          -- Stripe Price ID for annual billing
  price_monthly   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  price_annual    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  max_devices     INTEGER NOT NULL DEFAULT 5,
  max_users       INTEGER NOT NULL DEFAULT 1,
  max_integrations INTEGER NOT NULL DEFAULT 1,
  telemetry_retention_days INTEGER NOT NULL DEFAULT 7,
  features        JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_public       BOOLEAN NOT NULL DEFAULT true,   -- visible on pricing page
  sort_order      INTEGER NOT NULL DEFAULT 0,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comment
COMMENT ON TABLE public.billing_plans IS 'Pricing tiers with feature limits and resource quotas. Foundation for billing system.';

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_billing_plans_active ON public.billing_plans(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_billing_plans_slug ON public.billing_plans(slug);
CREATE INDEX IF NOT EXISTS idx_billing_plans_sort ON public.billing_plans(sort_order);

-- ============================================================================
-- Updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_billing_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_plans_updated_at
  BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_billing_plans_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active plans
CREATE POLICY "Authenticated users can read active plans"
  ON public.billing_plans
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Service role has full access (for admin CRUD and seeding)
CREATE POLICY "Service role full access"
  ON public.billing_plans
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Seed Data: Free, Starter, Professional, Enterprise
-- ============================================================================
INSERT INTO public.billing_plans (name, slug, price_monthly, price_annual, max_devices, max_users, max_integrations, telemetry_retention_days, features, is_active, is_public, sort_order, description)
VALUES
  (
    'Free',
    'free',
    0.00,
    0.00,
    5,
    1,
    1,
    7,
    '{
      "ai_analytics": false,
      "pdf_export": false,
      "mfa": false,
      "custom_branding": false,
      "api_access": false,
      "priority_support": false,
      "sla": false,
      "audit_log": false,
      "webhook_integrations": false,
      "email_alerts": true,
      "dashboard": true,
      "telemetry_charts": true
    }'::jsonb,
    true,
    true,
    1,
    'Get started with IoT monitoring. Perfect for hobby projects and evaluation.'
  ),
  (
    'Starter',
    'starter',
    29.00,
    290.00,
    25,
    5,
    3,
    30,
    '{
      "ai_analytics": false,
      "pdf_export": true,
      "mfa": true,
      "custom_branding": false,
      "api_access": true,
      "priority_support": false,
      "sla": false,
      "audit_log": true,
      "webhook_integrations": true,
      "email_alerts": true,
      "dashboard": true,
      "telemetry_charts": true
    }'::jsonb,
    true,
    true,
    2,
    'For small teams getting serious about IoT. Includes API access and audit logging.'
  ),
  (
    'Professional',
    'professional',
    99.00,
    990.00,
    100,
    25,
    10,
    90,
    '{
      "ai_analytics": true,
      "pdf_export": true,
      "mfa": true,
      "custom_branding": true,
      "api_access": true,
      "priority_support": true,
      "sla": false,
      "audit_log": true,
      "webhook_integrations": true,
      "email_alerts": true,
      "dashboard": true,
      "telemetry_charts": true
    }'::jsonb,
    true,
    true,
    3,
    'Full-featured platform for growing organizations. AI analytics and custom branding included.'
  ),
  (
    'Enterprise',
    'enterprise',
    0.00,
    0.00,
    -1,
    -1,
    -1,
    365,
    '{
      "ai_analytics": true,
      "pdf_export": true,
      "mfa": true,
      "custom_branding": true,
      "api_access": true,
      "priority_support": true,
      "sla": true,
      "audit_log": true,
      "webhook_integrations": true,
      "email_alerts": true,
      "dashboard": true,
      "telemetry_charts": true,
      "dedicated_support": true,
      "custom_integrations": true,
      "on_premise": true
    }'::jsonb,
    true,
    true,
    4,
    'Custom pricing for large deployments. Unlimited devices, users, and integrations with SLA guarantee.'
  )
ON CONFLICT (slug) DO NOTHING;
