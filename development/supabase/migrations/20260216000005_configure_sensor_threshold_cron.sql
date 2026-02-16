-- Configure pg_cron for Sensor Threshold Evaluator
-- Runs every 5 minutes to check sensor thresholds and create alerts

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Delete old alert-rules-evaluator job (we're replacing it with sensor-threshold-evaluator)
SELECT cron.unschedule('evaluate-alert-rules');

-- Create cron job to call sensor-threshold-evaluator Edge Function
-- This job runs every 5 minutes and checks all enabled thresholds
SELECT cron.schedule(
  'evaluate-sensor-thresholds', -- Job name
  '*/5 * * * *',                -- Cron schedule: every 5 minutes
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/sensor-threshold-evaluator',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- View all scheduled jobs
-- SELECT * FROM cron.job;

-- Delete job if needed (for troubleshooting)
-- SELECT cron.unschedule('evaluate-sensor-thresholds');
