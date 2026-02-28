-- ==========================================
-- MQTT Data Diagnostic Queries
-- ==========================================
-- Run in Supabase SQL Editor to check MQTT data

-- 1. Check integration_activity_log for MQTT messages
SELECT 
  created_at,
  activity_type,
  method,
  endpoint as topic,
  status,
  response_time_ms,
  metadata->>'deviceId' as device_id,
  metadata->>'messageSize' as message_size,
  error_message
FROM integration_activity_log
WHERE activity_type = 'mqtt_message_received'
ORDER BY created_at DESC
LIMIT 50;

-- 2. Check device_telemetry_history for parsed telemetry
SELECT 
  created_at,
  device_id,
  metric_name,
  metric_value,
  timestamp,
  metadata
FROM device_telemetry_history
ORDER BY created_at DESC
LIMIT 50;

-- 3. Check devices table for auto-discovered MQTT devices
SELECT 
  id as device_id,
  name,
  device_type,
  status,
  last_seen,
  integration_id,
  metadata->>'auto_discovered' as auto_discovered,
  metadata->>'discovered_at' as discovered_at,
  created_at
FROM devices
WHERE device_type = 'mqtt_device'
   OR (metadata->>'auto_discovered')::boolean = true
ORDER BY created_at DESC;

-- 4. Check active MQTT integrations
SELECT 
  id,
  name,
  integration_type,
  status,
  settings->>'brokerUrl' as broker_url,
  settings->>'port' as port,
  settings->>'topics' as topics,
  created_at
FROM device_integrations
WHERE integration_type IN ('mqtt', 'mqtt_external', 'mqtt_hosted')
  AND status = 'active';

-- 5. Summary: Recent MQTT activity (last hour)
SELECT 
  DATE_TRUNC('minute', created_at) as minute,
  COUNT(*) as message_count,
  COUNT(DISTINCT metadata->>'deviceId') as unique_devices,
  AVG(response_time_ms)::int as avg_processing_ms,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM integration_activity_log
WHERE activity_type = 'mqtt_message_received'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY DATE_TRUNC('minute', created_at)
ORDER BY minute DESC;

-- 6. Check for MQTT errors
SELECT 
  created_at,
  endpoint as topic,
  error_message,
  metadata
FROM integration_activity_log
WHERE activity_type = 'mqtt_message_received'
  AND status = 'failed'
ORDER BY created_at DESC
LIMIT 20;

-- 7. Telemetry by device (last 24 hours)
SELECT 
  device_id,
  COUNT(*) as data_points,
  COUNT(DISTINCT metric_name) as unique_metrics,
  MIN(timestamp) as first_seen,
  MAX(timestamp) as last_seen,
  ARRAY_AGG(DISTINCT metric_name) as metrics
FROM device_telemetry_history
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY device_id
ORDER BY data_points DESC;
