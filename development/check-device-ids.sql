-- Check the device you showed me
SELECT id, name, device_type, status, integration_id, 
       metadata->>'externalId' as external_id,
       created_at
FROM devices
WHERE id = '9307a117-e076-4cc9-b897-a088beffce6b';

-- Check if device ending in 01 exists
SELECT id, name, metadata->>'externalId' as external_id
FROM devices
WHERE metadata->>'externalId' = '2400390030314701';

-- Check recent activity logs for both devices
SELECT DISTINCT metadata->>'deviceId' as device_id, COUNT(*) as message_count
FROM integration_activity_log
WHERE integration_id = 'a6d0e905-0532-4178-9ed0-2aae24a896f6'
AND metadata->>'deviceId' IN ('2400390030314700', '2400390030314701')
GROUP BY metadata->>'deviceId'
ORDER BY device_id;
