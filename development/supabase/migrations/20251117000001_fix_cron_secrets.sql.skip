-- Alternative: Store secrets in a custom encrypted table
-- This works without superuser vault permissions

-- Create a custom secrets table with encryption
CREATE TABLE IF NOT EXISTS public.pg_cron_secrets (
    name TEXT PRIMARY KEY,
    secret TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS to protect the secrets
ALTER TABLE public.pg_cron_secrets ENABLE ROW LEVEL SECURITY;

-- Only service role can access (no user access)
CREATE POLICY "Service role only" ON public.pg_cron_secrets
    FOR ALL
    USING (false);

-- Insert the secrets
-- IMPORTANT: Replace placeholder values with actual secrets before running this migration.
-- Get these from environment variables or Supabase Dashboard → Settings → API.
INSERT INTO public.pg_cron_secrets (name, secret)
VALUES
  ('project_url', current_setting('app.supabase_url', true)),
  ('service_role_key', current_setting('app.service_role_key', true))
ON CONFLICT (name) DO UPDATE SET 
  secret = EXCLUDED.secret,
  updated_at = NOW();
-- To set these before running:
-- ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key';

-- Update the cron job to use the custom table instead of vault
SELECT cron.unschedule('auto-sync-cron-job');

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

-- Verify everything is set up
SELECT name, created_at, updated_at FROM public.pg_cron_secrets;
SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'auto-sync-cron-job';
