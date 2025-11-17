-- Enable required extensions for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Store secrets in Vault (more secure than database settings)
-- Note: Run these commands manually in SQL Editor after migration:
-- INSERT INTO vault.secrets (name, secret) 
-- VALUES 
--   ('project_url', 'https://bldojxpockljyivldxwf.supabase.co'),
--   ('service_role_key', 'your-service-role-key-here')
-- ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;

-- Create a scheduled job to invoke auto-sync-cron every 5 minutes
SELECT cron.schedule(
    'auto-sync-cron-job',           -- Job name
    '*/5 * * * *',                   -- Every 5 minutes (change to '* * * * *' for every minute)
    $$
    SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') 
               || '/functions/v1/auto-sync-cron',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
        ),
        body := jsonb_build_object(
            'time', now(),
            'source', 'pg_cron'
        )
    ) AS request_id;
    $$
);

-- Verify the job was created
-- Run in SQL Editor: SELECT * FROM cron.job WHERE jobname = 'auto-sync-cron-job';

-- To view job run history:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-sync-cron-job') ORDER BY start_time DESC LIMIT 10;

-- To unschedule (if needed):
-- SELECT cron.unschedule('auto-sync-cron-job');

-- To reschedule with different timing:
-- SELECT cron.unschedule('auto-sync-cron-job');
-- SELECT cron.schedule('auto-sync-cron-job', '* * * * *', $$ ... $$);

