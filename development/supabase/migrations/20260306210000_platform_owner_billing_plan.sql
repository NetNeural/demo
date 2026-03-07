-- ============================================================================
-- Add platform_owner billing plan with unlimited limits
-- Fixes: NetNeural org has subscription_tier = 'platform_owner' but no
-- matching billing_plans row, causing server-side seat enforcement to
-- fall back to starter (3 users).
-- ============================================================================

INSERT INTO public.billing_plans (
  name, slug, pricing_model,
  price_per_device, price_monthly, price_annual,
  max_devices, max_users, max_integrations, telemetry_retention_days,
  features, is_active, is_public, sort_order, description
)
VALUES (
  'Platform Owner',
  'platform_owner',
  'custom',
  0.00, 0.00, 0.00,
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
  false,   -- internal plan, not public
  0,
  'Internal platform owner plan. Unlimited access to all features. No billing required.'
)
ON CONFLICT (slug) DO UPDATE SET
  max_devices = EXCLUDED.max_devices,
  max_users = EXCLUDED.max_users,
  max_integrations = EXCLUDED.max_integrations,
  telemetry_retention_days = EXCLUDED.telemetry_retention_days,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  updated_at = now();
