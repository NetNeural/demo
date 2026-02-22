-- ============================================================================
-- Device & Integration Diagnostics
-- Device: fad72889-fe43-4277-8101-932e93314091
-- Integration: a6d0e905-0532-4178-9ed0-2aae24a896f6
-- ============================================================================

-- 1. Check device details
SELECT 
    id,
    name,
    status,
    last_seen,
    integration_id,
    metadata
FROM devices
WHERE id = 'fad72889-fe43-4277-8101-932e93314091';

-- 2. Check recent activity logs for this device
SELECT 
    created_at,
    activity_type,
    direction,
    status,
    metadata
FROM integration_activity_log
WHERE integration_id = 'a6d0e905-0532-4178-9ed0-2aae24a896f6'
  AND metadata::text LIKE '%2400390030314701%'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check if telemetry exists for this device
SELECT 
    COUNT(*) as telemetry_count,
    MAX(created_at) as last_telemetry_time
FROM device_telemetry_history
WHERE device_id = 'fad72889-fe43-4277-8101-932e93314091';

-- 4. Check integration parser configuration
SELECT 
    id,
    name,
    integration_type,
    settings->>'payload_parser' as parser_type,
    settings->>'broker_url' as broker_url,
    settings->>'topics' as topics
FROM device_integrations
WHERE id = 'a6d0e905-0532-4178-9ed0-2aae24a896f6';

-- 5. Find ALL devices that might match 2400390030314701
SELECT 
    id,
    name,
    status,
    last_seen,
    integration_id
FROM devices
WHERE name LIKE '%2400390030314701%'
   OR metadata::text LIKE '%2400390030314701%';

-- 6. Check recent logs with empty telemetryKeys
SELECT 
    created_at,
    activity_type,
    metadata->'deviceId' as device_id,
    metadata->'telemetryKeys' as telemetry_keys,
    metadata->'messageSize' as message_size
FROM integration_activity_log
WHERE integration_id = 'a6d0e905-0532-4178-9ed0-2aae24a896f6'
  AND metadata->>'deviceId' = '2400390030314701'
ORDER BY created_at DESC
LIMIT 5;
