-- #292: Change billing plans to per-sensor pricing model
-- Replaces: Free/Starter/Professional/Enterprise (flat-rate)
-- New: Monitor ($2/sensor/mo) / Protect ($4/sensor/mo) / Command ($6/sensor/mo)
-- Requested by: heath.scheiman@netneural.ai

-- ============================================================================
-- Step 1: Add per-device pricing column
-- ============================================================================
ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS price_per_device NUMERIC(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.billing_plans.price_per_device
  IS 'Per-sensor/device monthly price. Core pricing unit for Monitor/Protect/Command plans.';

-- Also add a pricing_model column to distinguish flat vs per-device
ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS pricing_model TEXT NOT NULL DEFAULT 'flat'
  CHECK (pricing_model IN ('flat', 'per_device', 'custom'));

COMMENT ON COLUMN public.billing_plans.pricing_model
  IS 'Pricing model: flat (fixed monthly), per_device (price × sensor count), custom (enterprise negotiated).';

-- ============================================================================
-- Step 2: Deactivate old plans (preserve for historical subscription references)
-- ============================================================================
UPDATE public.billing_plans
SET is_active = false, is_public = false, updated_at = now()
WHERE slug IN ('free', 'starter', 'professional', 'enterprise');

-- ============================================================================
-- Step 3: Insert new per-sensor plans
-- ============================================================================
INSERT INTO public.billing_plans (
  name, slug, pricing_model, price_per_device,
  price_monthly, price_annual,
  max_devices, max_users, max_integrations, telemetry_retention_days,
  features, is_active, is_public, sort_order, description
)
VALUES
  -- Monitor: $2/sensor/month — Core compliance + visibility
  (
    'Monitor',
    'monitor',
    'per_device',
    2.00,
    0.00,    -- base price is $0 (all pricing is per-device)
    0.00,
    -1,      -- unlimited devices (billed per device)
    5,       -- 5 users included
    1,       -- 1 integration
    30,      -- 30-day retention
    '{
      "dashboard": true,
      "telemetry_charts": true,
      "email_alerts": true,
      "sms_alerts": true,
      "compliance_logs": true,
      "haccp_export": true,
      "manual_report_export": true,
      "ai_analytics": false,
      "predictive_alerts": false,
      "multi_site_dashboard": false,
      "role_based_access": false,
      "api_access": false,
      "automated_audit_reporting": false,
      "ai_optimization": false,
      "chain_benchmarking": false,
      "esg_reporting": false,
      "carbon_analytics": false,
      "custom_integrations": false,
      "dedicated_support": false,
      "sla": false,
      "pdf_export": false,
      "mfa": false,
      "custom_branding": false,
      "audit_log": false,
      "webhook_integrations": false,
      "priority_support": false
    }'::jsonb,
    true,
    true,
    1,
    'Core compliance + visibility layer. Real-time monitoring, automated compliance logs, and alerting. $2 per sensor/month.'
  ),

  -- Protect: $4/sensor/month — Operational intelligence
  (
    'Protect',
    'protect',
    'per_device',
    4.00,
    0.00,
    0.00,
    -1,      -- unlimited devices (billed per device)
    25,      -- 25 users
    5,       -- 5 integrations
    365,     -- 1-year retention
    '{
      "dashboard": true,
      "telemetry_charts": true,
      "email_alerts": true,
      "sms_alerts": true,
      "compliance_logs": true,
      "haccp_export": true,
      "manual_report_export": true,
      "ai_analytics": true,
      "predictive_alerts": true,
      "multi_site_dashboard": true,
      "role_based_access": true,
      "api_access": true,
      "automated_audit_reporting": true,
      "ai_optimization": false,
      "chain_benchmarking": false,
      "esg_reporting": false,
      "carbon_analytics": false,
      "custom_integrations": false,
      "dedicated_support": false,
      "sla": false,
      "pdf_export": true,
      "mfa": true,
      "custom_branding": false,
      "audit_log": true,
      "webhook_integrations": true,
      "priority_support": false
    }'::jsonb,
    true,
    true,
    2,
    'Operational intelligence layer. AI anomaly detection, predictive alerts, multi-site dashboard, and API access. $4 per sensor/month.'
  ),

  -- Command: $6/sensor/month — Enterprise optimization + sustainability
  (
    'Command',
    'command',
    'per_device',
    6.00,
    0.00,
    0.00,
    -1,      -- unlimited devices (billed per device)
    -1,      -- unlimited users
    -1,      -- unlimited integrations
    -1,      -- unlimited retention
    '{
      "dashboard": true,
      "telemetry_charts": true,
      "email_alerts": true,
      "sms_alerts": true,
      "compliance_logs": true,
      "haccp_export": true,
      "manual_report_export": true,
      "ai_analytics": true,
      "predictive_alerts": true,
      "multi_site_dashboard": true,
      "role_based_access": true,
      "api_access": true,
      "automated_audit_reporting": true,
      "ai_optimization": true,
      "chain_benchmarking": true,
      "esg_reporting": true,
      "carbon_analytics": true,
      "custom_integrations": true,
      "dedicated_support": true,
      "sla": true,
      "pdf_export": true,
      "mfa": true,
      "custom_branding": true,
      "audit_log": true,
      "webhook_integrations": true,
      "priority_support": true
    }'::jsonb,
    true,
    true,
    3,
    'Enterprise optimization + sustainability layer. AI optimization insights, ESG reporting, chain benchmarking, and dedicated support. $6 per sensor/month.'
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  pricing_model = EXCLUDED.pricing_model,
  price_per_device = EXCLUDED.price_per_device,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  max_devices = EXCLUDED.max_devices,
  max_users = EXCLUDED.max_users,
  max_integrations = EXCLUDED.max_integrations,
  telemetry_retention_days = EXCLUDED.telemetry_retention_days,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  is_public = EXCLUDED.is_public,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description,
  updated_at = now();
