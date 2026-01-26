-- Configure Supabase pg_cron for Alert Rules Evaluator
-- Runs every 5 minutes to evaluate enabled alert rules

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job to call alert-rules-evaluator Edge Function
-- This job runs every 5 minutes and invokes the evaluator
SELECT cron.schedule(
  'evaluate-alert-rules', -- Job name
  '*/5 * * * *',          -- Cron schedule: every 5 minutes
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/alert-rules-evaluator',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Add configuration settings (these should be set via environment variables)
-- ALTER DATABASE postgres SET app.supabase_url TO 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.supabase_service_role_key TO 'your-service-role-key';

-- View scheduled jobs
-- SELECT * FROM cron.job;

-- Delete job if needed (for troubleshooting)
-- SELECT cron.unschedule('evaluate-alert-rules');
