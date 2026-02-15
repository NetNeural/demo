-- Check Golioth integration configuration
-- Run this in Supabase SQL Editor for staging

SELECT 
  id,
  name,
  integration_type,
  status,
  project_id,
  base_url,
  api_key_encrypted IS NOT NULL as has_encrypted_key,
  length(api_key_encrypted) as key_length,
  settings->>'apiKey' IS NOT NULL as has_api_key_in_settings,
  length(settings->>'apiKey') as settings_key_length,
  settings->>'projectId' as settings_project_id,
  webhook_enabled,
  settings->>'syncEnabled' as sync_enabled,
  last_sync_at,
  created_at,
  updated_at
FROM device_integrations
WHERE integration_type = 'golioth';
