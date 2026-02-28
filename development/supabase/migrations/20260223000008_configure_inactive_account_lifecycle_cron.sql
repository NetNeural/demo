-- Schedule inactive/unactivated account lifecycle processing
-- Issue #184: reminder every 5 days, disable + delete after 20 days

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inactive-account-lifecycle') THEN
    PERFORM cron.unschedule('inactive-account-lifecycle');
  END IF;
END $$;

SELECT cron.schedule(
  'inactive-account-lifecycle',
  '30 0 * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/inactive-account-lifecycle-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- For troubleshooting:
-- SELECT * FROM cron.job WHERE jobname = 'inactive-account-lifecycle';
-- SELECT cron.unschedule('inactive-account-lifecycle');
