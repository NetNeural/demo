-- Diagnose Golioth Integration Credentials
-- Run this in BOTH staging and production SQL editors

SELECT 
  id,
  name,
  integration_type,
  status,
  
  -- Check API Key sources
  CASE 
    WHEN api_key_encrypted IS NOT NULL THEN '✅ api_key_encrypted (preferred)'
    WHEN settings->>'apiKey' IS NOT NULL THEN '⚠️  settings.apiKey (fallback)'
    ELSE '❌ NO API KEY FOUND'
  END as api_key_source,
  
  -- Check Project ID sources
  CASE 
    WHEN project_id IS NOT NULL THEN '✅ project_id: ' || project_id
    WHEN settings->>'projectId' IS NOT NULL THEN '⚠️  settings.projectId: ' || (settings->>'projectId')
    ELSE '❌ NO PROJECT ID FOUND'
  END as project_id_source,
  
  -- Additional diagnostics
  length(api_key_encrypted) as encrypted_key_length,
  length(settings->>'apiKey') as settings_key_length,
  base_url,
  webhook_enabled,
  settings->>'syncEnabled' as sync_enabled,
  last_sync_at,
  created_at
  
FROM device_integrations
WHERE integration_type = 'golioth';
