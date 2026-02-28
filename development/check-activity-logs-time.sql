-- Check when your activity logs were created
SELECT 
  DATE(created_at) as log_date,
  COUNT(*) as log_count,
  MIN(created_at) as earliest_log,
  MAX(created_at) as latest_log
FROM integration_activity_log
GROUP BY DATE(created_at)
ORDER BY log_date DESC
LIMIT 10;

-- Check logs from last 24 hours (what the UI shows)
SELECT 
  COUNT(*) as logs_last_24h
FROM integration_activity_log
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- See a few recent logs
SELECT 
  id,
  activity_type,
  status,
  created_at,
  direction,
  error_message
FROM integration_activity_log
ORDER BY created_at DESC
LIMIT 5;
