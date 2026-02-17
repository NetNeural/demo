-- Check telemetry data for IoT sensor device 9a974aa0-7993-46d4-af7e-3a629060214a
-- to verify what fields are actually available

-- 1. Get latest telemetry with all JSONB keys
SELECT 
  id,
  device_id,
  received_at,
  device_timestamp,
  telemetry,
  jsonb_object_keys(telemetry) as available_keys
FROM device_telemetry_history
WHERE device_id = '9a974aa0-7993-46d4-af7e-3a629060214a'
ORDER BY received_at DESC
LIMIT 5;

-- 2. Check specifically for battery, rssi, uptime, firmware_version fields
SELECT 
  received_at,
  telemetry->>'battery' as battery,
  telemetry->>'rssi' as rssi,
  telemetry->>'uptime' as uptime,
  telemetry->>'firmware_version' as firmware_version,
  telemetry->>'type' as sensor_type,
  telemetry->>'value' as sensor_value
FROM device_telemetry_history
WHERE device_id = '9a974aa0-7993-46d4-af7e-3a629060214a'
ORDER BY received_at DESC
LIMIT 10;

-- 3. Check device table for battery_level and signal_strength
SELECT 
  id,
  name,
  device_id,
  battery_level,
  signal_strength,
  firmware_version,
  status,
  last_seen
FROM devices
WHERE id = '9a974aa0-7993-46d4-af7e-3a629060214a';
