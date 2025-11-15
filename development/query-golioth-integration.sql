-- Query Golioth integration details from local Supabase
-- Run this in SQLTools or VS Code PostgreSQL extension

SELECT 
  id,
  organization_id,
  name,
  project_id,
  base_url,
  CASE 
    WHEN api_key_encrypted IS NOT NULL THEN 'PRESENT (' || length(api_key_encrypted) || ' chars)'
    ELSE 'MISSING'
  END as api_key_status,
  CASE 
    WHEN settings IS NOT NULL THEN jsonb_pretty(settings::jsonb)
    ELSE 'null'
  END as settings_json,
  status,
  created_at,
  updated_at
FROM device_integrations 
WHERE integration_type = 'golioth'
LIMIT 1;

-- Also check devices table for any linked devices
SELECT COUNT(*) as device_count
FROM devices
WHERE integration_id IN (
  SELECT id FROM device_integrations WHERE integration_type = 'golioth'
);
