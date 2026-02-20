-- ============================================================================
-- MQTT Integration Diagnostics
-- Check logs and device data for integration a6d0e905-0532-4178-9ed0-2aae24a896f6
-- ============================================================================

-- 1. Check the integration configuration
SELECT 
    id,
    name,
    integration_type,
    status,
    settings->>'payload_parser' as parser_type,
    settings->>'topics' as topics,
    settings->>'broker_url' as broker_url,
    created_at,
    last_test_at,
    last_test_status
FROM device_integrations
WHERE id = 'a6d0e905-0532-4178-9ed0-2aae24a896f6';

-- 2. Check recent activity logs (last 24 hours)
SELECT 
    created_at,
    activity_type,
    direction,
    status,
    error_message,
    metadata
FROM integration_activity_log
WHERE integration_id = 'a6d0e905-0532-4178-9ed0-2aae24a896f6'
ORDER BY created_at DESC
LIMIT 20;

-- 3. Check if the device exists
SELECT 
    id,
    name,
    status,
    last_seen,
    integration_id,
    metadata
FROM devices
WHERE id = '2400390030314701'
   OR id LIKE '%2400390030314701%';

-- 4. Check telemetry history for this device
SELECT 
    timestamp,
    metric_name,
    metric_value,
    metadata
FROM device_telemetry_history
WHERE device_id = '2400390030314701'
ORDER BY timestamp DESC
LIMIT 10;

-- 5. Count total logs for this integration (all time)
SELECT 
    COUNT(*) as total_logs,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
    MAX(created_at) as last_log_time
FROM integration_activity_log
WHERE integration_id = 'a6d0e905-0532-4178-9ed0-2aae24a896f6';

-- 6. Check MQTT credentials (if using hosted broker)
SELECT 
    username,
    client_id,
    topic_prefix,
    last_connected_at,
    connection_count
FROM mqtt_credentials
WHERE integration_id = 'a6d0e905-0532-4178-9ed0-2aae24a896f6';
