-- Check what types of activity logs you have
SELECT 
  activity_type,
  COUNT(*) as count
FROM integration_activity_log
GROUP BY activity_type
ORDER BY count DESC;

-- Check which integrations are logging
SELECT 
  i.name as integration_name,
  i.integration_type,
  COUNT(ial.*) as log_count
FROM integration_activity_log ial
JOIN device_integrations i ON ial.integration_id = i.id
GROUP BY i.name, i.integration_type
ORDER BY log_count DESC;

-- Check direction of logs
SELECT 
  direction,
  COUNT(*) as count
FROM integration_activity_log
GROUP BY direction;

-- Sample of recent logs with integration info
SELECT 
  ial.id,
  i.name as integration_name,
  i.integration_type,
  ial.activity_type,
  ial.direction,
  ial.status,
  ial.created_at
FROM integration_activity_log ial
LEFT JOIN device_integrations i ON ial.integration_id = i.id
ORDER BY ial.created_at DESC
LIMIT 10;
