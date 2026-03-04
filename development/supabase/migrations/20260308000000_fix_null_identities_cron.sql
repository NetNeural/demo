-- Schedule fix-null-identities Edge Function via pg_cron
-- Runs every 6 hours to detect and repair auth users whose identity
-- records are null (prevents email/password login).
--
-- Root cause: accounts created via admin API (invite / bulk import)
-- never receive an auth.identities row, so login always fails.
-- This cron job catches regressions automatically.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if it exists (idempotent)
SELECT cron.unschedule('fix-null-identities')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fix-null-identities');

-- Schedule: every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
SELECT cron.schedule(
  'fix-null-identities',
  '0 */6 * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/fix-null-identities',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
