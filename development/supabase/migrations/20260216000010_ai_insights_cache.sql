-- =============================================================================
-- AI Insights Cache Table
-- =============================================================================
-- Stores cached AI-generated insights to minimize OpenAI API calls and costs
-- Cache entries expire after 15 minutes by default
--
-- Date: 2026-02-16
-- Feature: OpenAI API Integration
-- Purpose: Cost optimization through intelligent caching
-- =============================================================================

-- Create ai_insights_cache table
CREATE TABLE IF NOT EXISTS public.ai_insights_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    insights JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    token_usage INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast cache lookups
CREATE INDEX IF NOT EXISTS idx_ai_insights_cache_device_id 
    ON public.ai_insights_cache(device_id);

CREATE INDEX IF NOT EXISTS idx_ai_insights_cache_expires_at 
    ON public.ai_insights_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_ai_insights_cache_organization_id 
    ON public.ai_insights_cache(organization_id);

-- Composite index for the most common query pattern
CREATE INDEX IF NOT EXISTS idx_ai_insights_cache_device_expires 
    ON public.ai_insights_cache(device_id, expires_at DESC);

-- RLS Policies
ALTER TABLE public.ai_insights_cache ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for Edge Functions)
CREATE POLICY "ai_insights_cache_service_all" ON public.ai_insights_cache
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Users can view cached insights for their organization's devices
CREATE POLICY "ai_insights_cache_select_authenticated" ON public.ai_insights_cache
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.devices d
            WHERE d.id = ai_insights_cache.device_id
            AND d.organization_id = ai_insights_cache.organization_id
        )
    );

-- Auto-update updated_at timestamp
CREATE TRIGGER update_ai_insights_cache_updated_at
    BEFORE UPDATE ON public.ai_insights_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Clean up expired cache entries (run daily via pg_cron)
-- This prevents the table from growing indefinitely
CREATE OR REPLACE FUNCTION cleanup_expired_ai_insights_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.ai_insights_cache
    WHERE expires_at < NOW() - INTERVAL '1 day';
    
    RAISE NOTICE 'Cleaned up expired AI insights cache entries';
END;
$$;

-- Schedule cleanup job (if pg_cron is available)
-- Run daily at 2 AM
DO $$
BEGIN
    -- Only create cron job if pg_cron extension exists
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'cleanup-ai-insights-cache',
            '0 2 * * *', -- Every day at 2 AM
            'SELECT cleanup_expired_ai_insights_cache();'
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron not available, skipping scheduled cleanup';
END;
$$;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE public.ai_insights_cache IS 'Cached AI-generated insights from OpenAI to minimize API costs';
COMMENT ON COLUMN public.ai_insights_cache.device_id IS 'Device these insights are for';
COMMENT ON COLUMN public.ai_insights_cache.insights IS 'JSON array of AI-generated insights';
COMMENT ON COLUMN public.ai_insights_cache.expires_at IS 'When this cache entry expires (typically 15 minutes after generation)';
COMMENT ON COLUMN public.ai_insights_cache.token_usage IS 'OpenAI tokens consumed to generate these insights';
COMMENT ON FUNCTION cleanup_expired_ai_insights_cache IS 'Removes expired cache entries older than 1 day';
