-- Check device metadata structure for device 9a974aa0-7993-46d4-af7e-3a629060214a
SELECT 
  id,
  name,
  device_id,
  device_type,
  battery_level,
  signal_strength,
  firmware_version,
  status,
  last_seen,
  jsonb_pretty(metadata) as metadata_pretty,
  metadata ? 'battery_level' as has_battery_level,
  metadata ? 'rssi' as has_rssi,
  metadata ? 'signal_strength' as has_signal_strength,
  metadata ? 'uptime' as has_uptime,
  metadata ? 'firmware_version' as has_firmware_version
FROM devices
WHERE id = '9a974aa0-7993-46d4-af7e-3a629060214a';

-- Check which integration this device is using
SELECT 
  di.id,
  di.type,
  di.status,
  di.last_sync,
  d.name as device_name
FROM device_integrations di
JOIN devices d ON d.id = di.device_id
WHERE d.id = '9a974aa0-7993-46d4-af7e-3a629060214a';

-- Check raw telemetry structure
SELECT 
  received_at,
  jsonb_pretty(telemetry) as telemetry_structure
FROM device_telemetry_history
WHERE device_id = '9a974aa0-7993-46d4-af7e-3a629060214a'
ORDER BY received_at DESC
LIMIT 3;
