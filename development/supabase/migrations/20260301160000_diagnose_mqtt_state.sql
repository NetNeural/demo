-- Diagnostic: MQTT state (read-only NOTICEs)
DO $$
DECLARE rec RECORD;
BEGIN
  RAISE NOTICE '=== MQTT CREDENTIALS ===';
  FOR rec IN
    SELECT mc.id, mc.username, mc.client_id, mc.organization_id, mc.integration_id,
           mc.topic_prefix, o.name AS org_name, di.name AS int_name, di.integration_type
    FROM mqtt_credentials mc
    LEFT JOIN organizations o ON mc.organization_id = o.id
    LEFT JOIN device_integrations di ON mc.integration_id = di.id
  LOOP
    RAISE NOTICE 'CRED: user=% org="%" int="%" type=% prefix=%',
      rec.username, rec.org_name, rec.int_name, rec.integration_type, rec.topic_prefix;
  END LOOP;

  RAISE NOTICE '=== TEMP TAG DEVICES (all orgs) ===';
  FOR rec IN
    SELECT d.id, d.name, d.serial_number, d.external_device_id, d.organization_id,
           d.integration_id, d.status, d.last_seen, o.name AS org_name,
           di.name AS int_name, di.integration_type
    FROM devices d
    LEFT JOIN organizations o ON d.organization_id = o.id
    LEFT JOIN device_integrations di ON d.integration_id = di.id
    WHERE d.name ILIKE '%temp%' OR d.name ILIKE '%mqtt%'
    ORDER BY o.name, d.name
  LOOP
    RAISE NOTICE 'DEV: name="%" serial=% ext_id=% org="%" int="%" (%) type=% status=% last_seen=%',
      rec.name, rec.serial_number, rec.external_device_id, rec.org_name,
      rec.int_name, rec.integration_id, rec.integration_type, rec.status, rec.last_seen;
  END LOOP;

  RAISE NOTICE '=== V-MARK ALL DEVICES ===';
  FOR rec IN
    SELECT d.id, d.name, d.serial_number, d.external_device_id, d.organization_id,
           d.integration_id, d.status, d.last_seen, o.name AS org_name,
           di.name AS int_name, di.integration_type
    FROM devices d
    LEFT JOIN organizations o ON d.organization_id = o.id
    LEFT JOIN device_integrations di ON d.integration_id = di.id
    WHERE o.name ILIKE '%v-mark%'
    ORDER BY d.name
  LOOP
    RAISE NOTICE 'V-MARK DEV: name="%" serial=% ext_id=% int="%" (%) type=% status=% last_seen=%',
      rec.name, rec.serial_number, rec.external_device_id,
      rec.int_name, rec.integration_id, rec.integration_type, rec.status, rec.last_seen;
  END LOOP;

  RAISE NOTICE '=== MQTT INTEGRATIONS (all orgs) ===';
  FOR rec IN
    SELECT di.id, di.name, di.integration_type, di.organization_id, di.status,
           di.webhook_url, di.webhook_enabled, o.name AS org_name
    FROM device_integrations di
    LEFT JOIN organizations o ON di.organization_id = o.id
    WHERE di.integration_type ILIKE '%mqtt%' OR di.name ILIKE '%mqtt%'
  LOOP
    RAISE NOTICE 'INT: name="%" id=% org="%" type=% status=% webhook_url=% webhook_enabled=%',
      rec.name, rec.id, rec.org_name, rec.integration_type, rec.status, rec.webhook_url, rec.webhook_enabled;
  END LOOP;

  RAISE NOTICE '=== RECENT TELEMETRY FOR V-MARK DEVICES ===';
  FOR rec IN
    SELECT d.name, dth.received_at, dth.organization_id, o.name AS org_name
    FROM device_telemetry_history dth
    JOIN devices d ON dth.device_id = d.id
    LEFT JOIN organizations o ON dth.organization_id = o.id
    WHERE d.organization_id IN (SELECT id FROM organizations WHERE name ILIKE '%v-mark%')
    ORDER BY dth.received_at DESC
    LIMIT 5
  LOOP
    RAISE NOTICE 'TELEMETRY: device="%" at=% org="%"', rec.name, rec.received_at, rec.org_name;
  END LOOP;
END $$;
