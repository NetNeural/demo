-- Local Golioth Integration Settings
-- Run this against LOCAL database (localhost:54322)
SELECT 
  'LOCAL' as environment,
  id,
  name,
  integration_type,
  project_id,
  base_url,
  LENGTH(api_key_encrypted) as api_key_length,
  settings->>'projectId' as settings_project_id,
  settings->>'baseUrl' as settings_base_url,
  settings->>'syncEnabled' as sync_enabled,
  status,
  created_at,
  updated_at
FROM device_integrations 
WHERE integration_type = 'golioth';

-- COUNT devices
SELECT 
  'LOCAL' as environment,
  COUNT(*) as device_count,
  COUNT(CASE WHEN status = 'online' THEN 1 END) as online_count
FROM devices 
WHERE integration_id = (SELECT id FROM device_integrations WHERE integration_type = 'golioth');
