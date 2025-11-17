-- Fix: Cron job is still using vault instead of pg_cron_secrets
-- This updates the existing cron job to use the correct secrets table

-- Remove the old cron job
SELECT cron.unschedule('auto-sync-cron-job');

-- Recreate with correct query using pg_cron_secrets table
SELECT cron.schedule(
    'auto-sync-cron-job',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := (SELECT secret FROM public.pg_cron_secrets WHERE name = 'project_url') 
               || '/functions/v1/auto-sync-cron',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT secret FROM public.pg_cron_secrets WHERE name = 'service_role_key')
        ),
        body := jsonb_build_object(
            'time', now(),
            'source', 'pg_cron'
        )
    ) AS request_id;
    $$
);

-- Verify the update
SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname = 'auto-sync-cron-job';
