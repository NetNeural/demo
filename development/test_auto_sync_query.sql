-- Test the exact query that auto-sync-cron function runs
-- This will help identify if the issue is with the database query

-- First, check if auto_sync_schedules table exists and has data
SELECT 
  COUNT(*) as total_schedules,
  COUNT(*) FILTER (WHERE enabled = true) as enabled_schedules,
  COUNT(*) FILTER (WHERE enabled = true AND next_run_at <= now()) as schedules_due
FROM auto_sync_schedules;

-- Try the exact query from the function (with join)
SELECT 
  s.*,
  i.id as integration_id,
  i.type as integration_type,
  i.config as integration_config,
  i.organization_id as integration_org_id
FROM auto_sync_schedules s
LEFT JOIN device_integrations i ON s.integration_id = i.id
WHERE s.enabled = true
  AND s.next_run_at <= now();

-- Check if device_integrations table exists
SELECT COUNT(*) as total_integrations
FROM device_integrations;

-- Check RLS policies on auto_sync_schedules
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'auto_sync_schedules';
