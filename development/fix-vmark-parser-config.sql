-- Check your MQTT integration settings
SELECT 
  id,
  name,
  integration_type,
  settings
FROM device_integrations
WHERE id = 'a6d0e905-0532-4178-9ed0-2aae24a896f6';

-- Update integration to use V-Mark parser if needed
UPDATE device_integrations
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{payloadParser}',
  '"vmark"'
)
WHERE id = 'a6d0e905-0532-4178-9ed0-2aae24a896f6';

-- Verify the update
SELECT 
  id,
  name,
  settings->>'payloadParser' as parser,
  settings
FROM device_integrations
WHERE id = 'a6d0e905-0532-4178-9ed0-2aae24a896f6';
