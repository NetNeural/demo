-- Diagnostic: Inspect MQTT integration settings for V-Mark and NetNeural
-- This helps determine if the external MQTT broker's webhook callback
-- is using the correct integration_id

DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== MQTT INTEGRATION SETTINGS ===';

  -- Query all MQTT-related integrations
  FOR rec IN
    SELECT
      di.id AS integration_id,
      di.organization_id,
      o.name AS org_name,
      di.name AS integration_name,
      di.integration_type,
      di.status,
      di.settings::text AS settings,
      di.webhook_url,
      di.created_at,
      di.updated_at
    FROM device_integrations di
    JOIN organizations o ON o.id = di.organization_id
    WHERE di.integration_type ILIKE '%mqtt%'
       OR di.name ILIKE '%mqtt%'
       OR di.id IN (
         '4cb3e31e-71ab-4c5c-a5e2-9a7fcd92cb21',
         'a6d0e905-0532-4178-9ed0-2aae24a896f6'
       )
    ORDER BY o.name, di.name
  LOOP
    RAISE NOTICE '---';
    RAISE NOTICE 'Org: % (%) ', rec.org_name, rec.organization_id;
    RAISE NOTICE 'Integration: % (%)', rec.integration_name, rec.integration_id;
    RAISE NOTICE 'Type: % | Status: %', rec.integration_type, rec.status;
    RAISE NOTICE 'Webhook URL: %', rec.webhook_url;
    RAISE NOTICE 'Settings: %', rec.settings;
    RAISE NOTICE 'Created: % | Updated: %', rec.created_at, rec.updated_at;
  END LOOP;

  -- Also check devices linked to these integrations
  RAISE NOTICE '';
  RAISE NOTICE '=== DEVICES ON MQTT INTEGRATIONS ===';
  FOR rec IN
    SELECT
      d.id AS device_id,
      d.name AS device_name,
      d.serial_number,
      d.external_device_id,
      d.integration_id,
      di.name AS integration_name,
      o.name AS org_name,
      d.last_seen,
      d.status
    FROM devices d
    JOIN device_integrations di ON di.id = d.integration_id
    JOIN organizations o ON o.id = d.organization_id
    WHERE di.integration_type ILIKE '%mqtt%'
       OR di.name ILIKE '%mqtt%'
    ORDER BY o.name, d.name
  LOOP
    RAISE NOTICE 'Device: % (%) serial=%', rec.device_name, rec.device_id, rec.serial_number;
    RAISE NOTICE '  Org: % | Integration: % (%)', rec.org_name, rec.integration_name, rec.integration_id;
    RAISE NOTICE '  Last Seen: % | Status: %', rec.last_seen, rec.status;
    RAISE NOTICE '  External ID: %', rec.external_device_id;
  END LOOP;

  -- Check recent telemetry for V-Mark devices
  RAISE NOTICE '';
  RAISE NOTICE '=== RECENT TELEMETRY FOR V-MARK MQTT DEVICES ===';
  FOR rec IN
    SELECT
      t.device_id,
      d.name AS device_name,
      t.data_type,
      t.recorded_at,
      t.created_at,
      LEFT(t.value::text, 100) AS value_preview
    FROM telemetry t
    JOIN devices d ON d.id = t.device_id
    WHERE d.organization_id = 'ba3e1c1e-e9ba-4d36-aec5-b25132bdc642'
    ORDER BY t.recorded_at DESC
    LIMIT 10
  LOOP
    RAISE NOTICE 'Device: % (%) type=%', rec.device_name, rec.device_id, rec.data_type;
    RAISE NOTICE '  Recorded: % | Created: %', rec.recorded_at, rec.created_at;
    RAISE NOTICE '  Value: %', rec.value_preview;
  END LOOP;
END $$;
