-- AI Insights Cache Tables
-- Migration to support AI features caching for cost optimization

-- AI Insights Cache (for device-level insights)
CREATE TABLE IF NOT EXISTS public.ai_insights_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  insights JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  token_usage INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Report Summaries Cache (for report-level summaries)
CREATE TABLE IF NOT EXISTS public.ai_report_summaries_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('alert-history', 'telemetry-trends', 'audit-log')),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  summary JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  token_usage INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_insights_cache_device ON public.ai_insights_cache(device_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_cache_org ON public.ai_insights_cache(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_cache_expires ON public.ai_insights_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_ai_report_cache_type_org ON public.ai_report_summaries_cache(report_type, organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_report_cache_expires ON public.ai_report_summaries_cache(expires_at);

-- RLS Policies
ALTER TABLE public.ai_insights_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_report_summaries_cache ENABLE ROW LEVEL SECURITY;

-- Users can only access cache for their organization
CREATE POLICY "Users can view AI insights cache for their organization"
  ON public.ai_insights_cache
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view AI report summaries cache for their organization"
  ON public.ai_report_summaries_cache
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Service role can insert/update/delete (for Edge Functions)
CREATE POLICY "Service role can manage AI insights cache"
  ON public.ai_insights_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage AI report summaries cache"
  ON public.ai_report_summaries_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Automatic cleanup function for expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_ai_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.ai_insights_cache WHERE expires_at < NOW();
  DELETE FROM public.ai_report_summaries_cache WHERE expires_at < NOW();
END;
$$;

-- Schedule cleanup to run daily (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-ai-cache', '0 2 * * *', 'SELECT cleanup_expired_ai_cache()');

COMMENT ON TABLE public.ai_insights_cache IS 'Caches AI-generated insights for device telemetry to reduce OpenAI API costs. Entries expire after 15 minutes.';
COMMENT ON TABLE public.ai_report_summaries_cache IS 'Caches AI-generated report summaries to reduce OpenAI API costs. Entries expire after 30 minutes.';
COMMENT ON FUNCTION cleanup_expired_ai_cache() IS 'Removes expired AI cache entries. Run daily via cron job.';
