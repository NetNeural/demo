-- Fix AI cache tables for edge function compatibility
-- Both generate-report-summary and ai-report-summary use cache_key for lookups/upserts
-- but the original migration didn't include the column.

-- 1. Add cache_key to ai_report_summaries_cache
ALTER TABLE public.ai_report_summaries_cache
  ADD COLUMN IF NOT EXISTS cache_key TEXT;

-- Drop the restrictive CHECK constraint so we can store any report type
ALTER TABLE public.ai_report_summaries_cache
  DROP CONSTRAINT IF EXISTS ai_report_summaries_cache_report_type_check;

-- Create unique index on cache_key for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_report_cache_key
  ON public.ai_report_summaries_cache(cache_key);

-- 2. Add cache_key to ai_insights_cache and make device_id nullable
--    (report-level summaries don't have a device_id)
ALTER TABLE public.ai_insights_cache
  ADD COLUMN IF NOT EXISTS cache_key TEXT;

ALTER TABLE public.ai_insights_cache
  ALTER COLUMN device_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_insights_cache_key
  ON public.ai_insights_cache(cache_key);
