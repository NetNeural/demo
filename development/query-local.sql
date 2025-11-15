-- RUN THIS IN SQLTOOLS: "Supabase Local" connection
-- Copy results and share with me

-- Integration settings
SELECT 
  'LOCAL' as environment,
  id,
  name,
  project_id,
  base_url,
  LENGTH(api_key_encrypted) as api_key_length,
  settings->>'projectId' as settings_project_id,
  LEFT(settings->>'apiKey', 10) || '...' as settings_api_key_preview,
  settings->>'syncEnabled' as sync_enabled,
  status
FROM device_integrations 
WHERE integration_type = 'golioth';

-- Device count
SELECT COUNT(*) as local_device_count
FROM devices 
WHERE integration_id IN (SELECT id FROM device_integrations WHERE integration_type = 'golioth');
