-- #56: Organization health scores table + admin customer overview view
-- Super-admin CRM page that aggregates data across all organizations
-- Depends on: organizations, devices, organization_members, subscriptions, billing_plans, invoices

-- ============================================================================
-- Table: org_health_scores
-- Materialized health score per organization, updated by cron edge function
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.org_health_scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  score                 INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  -- Component scores (each 0-100)
  login_frequency_score INTEGER NOT NULL DEFAULT 0,
  device_activity_score INTEGER NOT NULL DEFAULT 0,
  feature_adoption_score INTEGER NOT NULL DEFAULT 0,
  support_ticket_score  INTEGER NOT NULL DEFAULT 0,
  payment_health_score  INTEGER NOT NULL DEFAULT 0,
  -- Metadata
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.org_health_scores IS 'Materialized health scores per org. Updated by compute-health-scores edge function on a schedule.';
COMMENT ON COLUMN public.org_health_scores.score IS 'Weighted composite: login(25%) + device(25%) + feature(20%) + support(15%) + payment(15%)';

-- One score per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_health_scores_org
  ON public.org_health_scores(organization_id);

CREATE INDEX IF NOT EXISTS idx_org_health_scores_score
  ON public.org_health_scores(score);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_org_health_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS org_health_scores_updated_at ON public.org_health_scores;
CREATE TRIGGER org_health_scores_updated_at
  BEFORE UPDATE ON public.org_health_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_org_health_scores_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.org_health_scores ENABLE ROW LEVEL SECURITY;

-- Super admins can read all health scores
DROP POLICY IF EXISTS "Super admins can read health scores" ON public.org_health_scores;
CREATE POLICY "Super admins can read health scores"
  ON public.org_health_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- Service role has full access (edge function writes scores)
DROP POLICY IF EXISTS "Service role full access on health scores" ON public.org_health_scores;
CREATE POLICY "Service role full access on health scores"
  ON public.org_health_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- View: admin_customer_overview
-- Aggregates org + device + member + subscription + plan + health data
-- Super admin reads this via service_role or RLS-bypassed query
-- ============================================================================
CREATE OR REPLACE VIEW public.admin_customer_overview AS
SELECT
  o.id,
  o.name,
  o.slug,
  o.subscription_tier,
  o.is_active,
  o.created_at,
  o.updated_at AS last_updated,
  -- Device count
  (SELECT COUNT(*) FROM public.devices d WHERE d.organization_id = o.id) AS device_count,
  -- Member count
  (SELECT COUNT(DISTINCT om.user_id) FROM public.organization_members om WHERE om.organization_id = o.id) AS member_count,
  -- Active devices (seen in last 24h)
  (SELECT COUNT(*) FROM public.devices d WHERE d.organization_id = o.id AND d.last_seen > now() - interval '24 hours') AS active_device_count,
  -- Subscription info
  s.id AS subscription_id,
  s.status AS subscription_status,
  s.current_period_end,
  s.cancel_at_period_end,
  -- Plan info
  bp.name AS plan_name,
  bp.slug AS plan_slug,
  bp.price_monthly AS mrr,
  -- Health score
  COALESCE(hs.score, 0) AS health_score,
  hs.login_frequency_score,
  hs.device_activity_score,
  hs.feature_adoption_score,
  hs.support_ticket_score,
  hs.payment_health_score,
  hs.computed_at AS health_computed_at,
  -- Last user login across org
  (SELECT MAX(u.last_login) FROM public.users u WHERE u.organization_id = o.id) AS last_active
FROM public.organizations o
LEFT JOIN public.subscriptions s
  ON s.organization_id = o.id
  AND s.status IN ('active', 'trialing', 'past_due')
LEFT JOIN public.billing_plans bp
  ON bp.id = s.plan_id
LEFT JOIN public.org_health_scores hs
  ON hs.organization_id = o.id;

COMMENT ON VIEW public.admin_customer_overview IS 'Aggregated customer data for super admin CRM page. Joins orgs with devices, members, subscriptions, plans, and health scores.';
