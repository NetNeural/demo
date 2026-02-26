-- #244: Usage Metering System — multi-tenant quota tracking
-- Tracks per-organization resource consumption against plan limits
-- Depends on: billing_plans (#242), subscriptions (#243)

-- ============================================================================
-- Enum: metric_type
-- ============================================================================
CREATE TYPE public.usage_metric_type AS ENUM (
  'device_count',
  'user_count',
  'api_calls',
  'storage_bytes',
  'edge_function_invocations'
);

-- ============================================================================
-- Table: usage_metrics
-- Caches current resource counts per org to avoid expensive live counts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.usage_metrics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_type       public.usage_metric_type NOT NULL,
  current_value     BIGINT NOT NULL DEFAULT 0,
  period_start      TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  period_end        TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.usage_metrics IS 'Cached resource usage per organization. Updated daily via cron and on-demand.';
COMMENT ON COLUMN public.usage_metrics.current_value IS 'Current count/value for this metric. For device_count/user_count: live counts refreshed daily.';

-- Unique: one metric per org per type per period
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_metrics_org_type_period
  ON public.usage_metrics(organization_id, metric_type, period_start);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_org
  ON public.usage_metrics(organization_id);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_type
  ON public.usage_metrics(metric_type);

-- ============================================================================
-- Updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_usage_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER usage_metrics_updated_at
  BEFORE UPDATE ON public.usage_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_usage_metrics_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

-- Org members can read their own org's usage metrics
CREATE POLICY "Org members can read own usage"
  ON public.usage_metrics
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Service role has full access (cron jobs and edge functions write)
CREATE POLICY "Service role full access on usage_metrics"
  ON public.usage_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Function: refresh_usage_counts()
-- Recalculates device_count and user_count for all organizations
-- Called by pg_cron daily and on-demand from edge functions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refresh_usage_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _period_start TIMESTAMPTZ := date_trunc('month', now());
  _period_end   TIMESTAMPTZ := date_trunc('month', now()) + interval '1 month';
BEGIN
  -- Upsert device counts
  INSERT INTO public.usage_metrics (organization_id, metric_type, current_value, period_start, period_end)
  SELECT
    o.id,
    'device_count'::public.usage_metric_type,
    COALESCE(d.cnt, 0),
    _period_start,
    _period_end
  FROM public.organizations o
  LEFT JOIN (
    SELECT organization_id, count(*) AS cnt
    FROM public.devices
    WHERE is_active = true
    GROUP BY organization_id
  ) d ON d.organization_id = o.id
  WHERE o.is_active = true
  ON CONFLICT (organization_id, metric_type, period_start)
  DO UPDATE SET
    current_value = EXCLUDED.current_value,
    updated_at = now();

  -- Upsert user counts (from organization_members)
  INSERT INTO public.usage_metrics (organization_id, metric_type, current_value, period_start, period_end)
  SELECT
    o.id,
    'user_count'::public.usage_metric_type,
    COALESCE(u.cnt, 0),
    _period_start,
    _period_end
  FROM public.organizations o
  LEFT JOIN (
    SELECT organization_id, count(*) AS cnt
    FROM public.organization_members
    GROUP BY organization_id
  ) u ON u.organization_id = o.id
  WHERE o.is_active = true
  ON CONFLICT (organization_id, metric_type, period_start)
  DO UPDATE SET
    current_value = EXCLUDED.current_value,
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.refresh_usage_counts() IS 'Recalculates device and user counts for all orgs. Run daily via pg_cron.';

-- ============================================================================
-- Function: check_org_quota(org_id, metric_type)
-- Returns quota status: current usage, limit, percentage, enforcement level
-- Used by edge functions before allowing resource creation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_org_quota(
  p_organization_id UUID,
  p_metric_type public.usage_metric_type
)
RETURNS TABLE (
  current_usage BIGINT,
  plan_limit INTEGER,
  usage_percent NUMERIC,
  is_warning BOOLEAN,     -- >= 80%
  is_exceeded BOOLEAN,    -- >= 100%
  is_unlimited BOOLEAN,   -- plan_limit = -1
  plan_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  _current BIGINT;
  _limit   INTEGER;
  _plan    TEXT;
BEGIN
  -- Get the plan limit for this metric
  SELECT
    bp.name,
    CASE p_metric_type
      WHEN 'device_count' THEN bp.max_devices
      WHEN 'user_count' THEN bp.max_users
      WHEN 'api_calls' THEN -1          -- not yet enforced
      WHEN 'storage_bytes' THEN -1      -- not yet enforced
      WHEN 'edge_function_invocations' THEN -1  -- not yet enforced
      ELSE -1
    END
  INTO _plan, _limit
  FROM public.subscriptions s
  JOIN public.billing_plans bp ON bp.id = s.plan_id
  WHERE s.organization_id = p_organization_id
    AND s.status IN ('active', 'trialing')
  LIMIT 1;

  -- If no subscription found, use free plan defaults
  IF _limit IS NULL THEN
    SELECT bp.name,
      CASE p_metric_type
        WHEN 'device_count' THEN bp.max_devices
        WHEN 'user_count' THEN bp.max_users
        ELSE -1
      END
    INTO _plan, _limit
    FROM public.billing_plans bp
    WHERE bp.slug = 'free' AND bp.is_active = true
    LIMIT 1;

    -- Absolute fallback
    IF _limit IS NULL THEN
      _plan := 'Free';
      _limit := 5;
    END IF;
  END IF;

  -- Get current usage (prefer cached, fall back to live count)
  SELECT um.current_value INTO _current
  FROM public.usage_metrics um
  WHERE um.organization_id = p_organization_id
    AND um.metric_type = p_metric_type
    AND um.period_start = date_trunc('month', now())
  LIMIT 1;

  -- If no cached value, compute live
  IF _current IS NULL THEN
    CASE p_metric_type
      WHEN 'device_count' THEN
        SELECT count(*) INTO _current
        FROM public.devices
        WHERE organization_id = p_organization_id AND is_active = true;
      WHEN 'user_count' THEN
        SELECT count(*) INTO _current
        FROM public.organization_members
        WHERE organization_id = p_organization_id;
      ELSE
        _current := 0;
    END CASE;
  END IF;

  -- Return results
  RETURN QUERY SELECT
    _current AS current_usage,
    _limit AS plan_limit,
    CASE WHEN _limit > 0 THEN ROUND((_current::NUMERIC / _limit) * 100, 1)
         ELSE 0
    END AS usage_percent,
    CASE WHEN _limit > 0 THEN (_current::NUMERIC / _limit) >= 0.8
         ELSE false
    END AS is_warning,
    CASE WHEN _limit > 0 THEN _current >= _limit
         ELSE false
    END AS is_exceeded,
    (_limit = -1) AS is_unlimited,
    _plan AS plan_name;
END;
$$;

COMMENT ON FUNCTION public.check_org_quota(UUID, public.usage_metric_type)
  IS 'Returns quota status for an org+metric. Used before resource creation to enforce limits.';

-- ============================================================================
-- Initial data: run refresh_usage_counts to populate current metrics
-- ============================================================================
SELECT public.refresh_usage_counts();

-- ============================================================================
-- pg_cron: schedule daily usage refresh at 2 AM UTC
-- NOTE: pg_cron must be enabled in Supabase dashboard (Extensions > pg_cron)
-- If pg_cron is not available, the edge function handles on-demand refresh
-- ============================================================================
DO $$
BEGIN
  -- Only schedule if pg_cron extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'refresh-usage-counts-daily',
      '0 2 * * *',
      'SELECT public.refresh_usage_counts()'
    );
    RAISE NOTICE 'pg_cron job scheduled: refresh-usage-counts-daily at 2 AM UTC';
  ELSE
    RAISE NOTICE 'pg_cron extension not available — usage counts will refresh on-demand via edge functions';
  END IF;
END;
$$;
