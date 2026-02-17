-- Check telemetry data structure for device 9a974aa0-7993-46d4-af7e-3a629060214a
-- Run this in the Supabase SQL Editor for demo-stage.netneural.ai

-- Get the latest telemetry reading
SELECT 
  id,
  device_id,
  received_at,
  device_timestamp,
  telemetry,
  jsonb_pretty(telemetry) as telemetry_pretty,
  integration_id
FROM device_telemetry_history
WHERE device_id = '9a974aa0-7993-46d4-af7e-3a629060214a'
ORDER BY received_at DESC
LIMIT 5;

-- Check what keys are in the telemetry JSONB
SELECT DISTINCT
  jsonb_object_keys(telemetry) as telemetry_key
FROM device_telemetry_history
WHERE device_id = '9a974aa0-7993-46d4-af7e-3a629060214a'
ORDER BY telemetry_key;

-- Check device metadata structure
SELECT 
  id,
  name,
  device_id,
  battery_level,
  signal_strength,
  firmware_version,
  jsonb_pretty(metadata) as metadata_pretty
FROM devices
WHERE id = '9a974aa0-7993-46d4-af7e-3a629060214a';
