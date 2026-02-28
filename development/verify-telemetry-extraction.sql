-- Verify V-Mark telemetry extraction is working
-- Check most recent activity logs for populated telemetryKeys

SELECT 
  created_at AT TIME ZONE 'UTC' as time,
  metadata->>'deviceId' as device_id,
  metadata->>'telemetryKeys' as telemetry_keys,
  metadata->>'messageSize' as message_size,
  status,
  error_message
FROM integration_activity_log
WHERE integration_id = 'a6d0e905-0532-4178-9ed0-2aae24a896f6'
ORDER BY created_at DESC
LIMIT 10;

-- Check if temperature/RSSI data is being stored
SELECT 
  device_id,
  timestamp AT TIME ZONE 'UTC' as time,
  telemetry_key,
  numeric_value,
  unit
FROM device_telemetry_history
WHERE device_id IN (
  SELECT device_id 
  FROM devices 
  WHERE hardware_id IN ('2400390030314701', '3B00390030314701', '0AB259CFD040')
)
ORDER BY timestamp DESC
LIMIT 20;
