-- Create internal "Unlimited" plan for NetNeural (platform owner)
-- No billing required — full access to all features, no limits
-- Also auto-assigns NetNeural org to this plan via a subscription record

-- ============================================================================
-- Step 1: Insert the Unlimited plan (internal, not public)
-- ============================================================================
INSERT INTO public.billing_plans (
  name, slug, pricing_model, price_per_device,
  price_monthly, price_annual,
  max_devices, max_users, max_integrations, telemetry_retention_days,
  features, is_active, is_public, sort_order, description
)
VALUES (
  'Unlimited',
  'unlimited',
  'custom',
  0.00,
  0.00,
  0.00,
  -1,   -- unlimited devices
  -1,   -- unlimited users
  -1,   -- unlimited integrations
  -1,   -- unlimited retention
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
  false,   -- NOT public (internal plan only)
  0,
  'Internal platform plan for NetNeural. Unlimited access to all features. No billing required.'
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

-- ============================================================================
-- Step 2: Create a subscription for NetNeural org on the Unlimited plan
-- Uses a DO block to look up org + plan IDs dynamically
-- ============================================================================
DO $$
DECLARE
  v_plan_id UUID;
  v_org_id UUID;
BEGIN
  -- Get the Unlimited plan ID
  SELECT id INTO v_plan_id FROM public.billing_plans WHERE slug = 'unlimited' LIMIT 1;

  -- Find NetNeural org (look for the org with slug 'netneural-demo' or name containing 'NetNeural')
  SELECT id INTO v_org_id FROM public.organizations
    WHERE slug = 'netneural-demo'
       OR name ILIKE '%NetNeural%'
    ORDER BY created_at ASC
    LIMIT 1;

  IF v_plan_id IS NOT NULL AND v_org_id IS NOT NULL THEN
    -- Delete any existing active subscription for this org, then insert fresh
    DELETE FROM public.subscriptions
      WHERE organization_id = v_org_id
        AND status IN ('active', 'trialing', 'past_due');

    INSERT INTO public.subscriptions (
      organization_id, plan_id, status,
      current_period_start, current_period_end,
      cancel_at_period_end
    )
    VALUES (
      v_org_id, v_plan_id, 'active',
      now(), now() + INTERVAL '100 years',
      false
    );
  END IF;
END $$;
