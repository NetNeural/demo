-- Check for logs from your specific MQTT integration
SELECT 
  COUNT(*) as log_count
FROM integration_activity_log
WHERE integration_id = 'a6d0e905-0532-4178-9ed0-2aae24a896f6';

-- Check telemetry for device 2400390030314701
SELECT 
  dth.id,
  d.name as device_name,
  d.external_device_id,
  dth.received_at,
  dth.telemetry
FROM device_telemetry_history dth
LEFT JOIN devices d ON dth.device_id = d.id
WHERE d.external_device_id = '2400390030314701'
ORDER BY dth.received_at DESC
LIMIT 10;

-- Check if device exists
SELECT 
  id,
  name,
  external_device_id,
  status,
  last_seen
FROM devices
WHERE external_device_id = '2400390030314701';

-- Check recent telemetry from any device
SELECT 
  dth.id,
  d.external_device_id,
  dth.received_at,
  dth.telemetry
FROM device_telemetry_history dth
JOIN devices d ON dth.device_id = d.id
ORDER BY dth.received_at DESC
LIMIT 5;
