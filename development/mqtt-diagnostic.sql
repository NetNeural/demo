-- MQTT Data Diagnostic
-- Run this in Supabase SQL Editor to check your MQTT setup

-- ============================================================================
-- 1. Check if you have any devices
-- ============================================================================
SELECT 
  d.id,
  d.name,
  d.external_device_id,
  d.device_type,
  d.organization_id,
  o.name as org_name,
  d.status,
  d.last_seen,
  d.created_at
FROM devices d
LEFT JOIN organizations o ON d.organization_id = o.id
ORDER BY d.created_at DESC;

-- ============================================================================
-- 2. Check for any telemetry data
-- ============================================================================
SELECT 
  COUNT(*) as total_records,
  MIN(received_at) as oldest_data,
  MAX(received_at) as newest_data
FROM device_telemetry_history;

-- ============================================================================
-- 3. Recent telemetry data (if any)
-- ============================================================================
SELECT 
  dth.id,
  dth.device_id,
  d.name as device_name,
  dth.device_timestamp,
  dth.received_at,
  dth.telemetry,
  dth.integration_id
FROM device_telemetry_history dth
LEFT JOIN devices d ON dth.device_id = d.id
ORDER BY dth.received_at DESC
LIMIT 20;

-- ============================================================================
-- 4. Check integration activity logs
-- ============================================================================
SELECT 
  COUNT(*) as total_activity_logs
FROM integration_activity_log;

SELECT 
  ial.id,
  ial.integration_id,
  ial.activity_type,
  ial.direction,
  ial.status,
  ial.error_message,
  ial.created_at,
  ial.completed_at,
  ial.devices_processed,
  ial.metadata
FROM integration_activity_log ial
ORDER BY ial.created_at DESC
LIMIT 20;

-- ============================================================================
-- 5. Check device metadata for MQTT/Golioth settings
-- ============================================================================
SELECT 
  d.name,
  d.external_device_id,
  d.device_type,
  d.status,
  d.golioth_status,
  d.metadata,
  d.last_seen
FROM devices d
WHERE d.metadata IS NOT NULL
ORDER BY d.created_at DESC;

-- ============================================================================
-- 6. Summary
-- ============================================================================
SELECT 
  'Devices' as entity,
  COUNT(*) as count
FROM devices
UNION ALL
SELECT 
  'Telemetry Records' as entity,
  COUNT(*) as count
FROM device_telemetry_history
UNION ALL
SELECT 
  'Activity Logs' as entity,
  COUNT(*) as count
FROM integration_activity_log;
