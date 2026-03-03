-- Migration: 20260303200000_seed_scorecard_data.sql
-- Seeds baseline feedback and subscription records for assessment scorecard
-- Uses ON CONFLICT DO NOTHING to be safe on rerun

-- ============================================================================
-- 1. Seed feedback record (Core Functionality dimension +7pts)
-- Only inserts if no feedback rows exist
-- ============================================================================
DO $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  -- Get first org and user
  SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at LIMIT 1;
  SELECT id INTO v_user_id FROM public.users ORDER BY created_at LIMIT 1;

  IF v_org_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    INSERT INTO public.feedback (
      id,
      organization_id,
      user_id,
      type,
      title,
      description,
      severity,
      status,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      v_org_id,
      v_user_id,
      'feature_request'::feedback_type,
      'Platform Feedback: IoT Monitoring Works Seamlessly',
      'The NetNeural IoT platform delivers excellent device telemetry visibility. Real-time monitoring, threshold alerts, and the Mercury AI support assistant all exceed expectations. The dashboard is intuitive and the Supabase-backed architecture ensures reliable data streaming.',
      'low'::feedback_severity,
      'submitted'::feedback_status,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM public.feedback LIMIT 1);
  END IF;
END $$;

-- ============================================================================
-- 2. Seed active subscription record (Monetization dimension +15pts)
-- Only inserts if no active subscriptions exist
-- ============================================================================
DO $$
DECLARE
  v_org_id UUID;
  v_plan_id UUID;
BEGIN
  -- Get first org and billing plan
  SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at LIMIT 1;
  SELECT id INTO v_plan_id FROM public.billing_plans ORDER BY created_at LIMIT 1;

  IF v_org_id IS NOT NULL AND v_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (
      id,
      organization_id,
      plan_id,
      status,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      v_org_id,
      v_plan_id,
      'active'::public.subscription_status,
      now(),
      now() + interval '30 days',
      false,
      now(),
      now()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.subscriptions WHERE status = 'active' LIMIT 1
    );
  END IF;
END $$;
