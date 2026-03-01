-- ============================================================================
-- Migration: Move MQTT Hub (0AB259CFD040) to V-Mark Organization
-- ============================================================================
-- The hub device connects to an external MQTT broker and sends telemetry for
-- its child sensors (including the Temp tag now in V-Mark). Moving the hub to
-- V-Mark ensures all its sub-device data routes there correctly.
-- ============================================================================

DO $$
DECLARE
  v_vmark_org_id UUID;
  v_vmark_mqtt_int_id UUID;
  v_hub RECORD;
  v_updated INTEGER := 0;
BEGIN
  -- Find V-Mark org
  SELECT id INTO v_vmark_org_id
  FROM organizations
  WHERE name ILIKE '%v-mark%' OR name ILIKE '%vmark%'
  LIMIT 1;

  IF v_vmark_org_id IS NULL THEN
    RAISE EXCEPTION 'V-Mark organization not found';
  END IF;

  -- Find V-Mark's MQTT integration
  SELECT id INTO v_vmark_mqtt_int_id
  FROM device_integrations
  WHERE organization_id = v_vmark_org_id
    AND (integration_type ILIKE '%mqtt%' OR name ILIKE '%mqtt%')
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_vmark_mqtt_int_id IS NULL THEN
    RAISE EXCEPTION 'No MQTT integration found in V-Mark org %', v_vmark_org_id;
  END IF;

  RAISE NOTICE 'V-Mark org: %, MQTT integration: %', v_vmark_org_id, v_vmark_mqtt_int_id;

  -- Find all hub-related devices by name, serial_number, or external_device_id containing '0AB259CFD040'
  FOR v_hub IN
    SELECT d.id, d.name, d.serial_number, d.external_device_id,
           d.organization_id, d.integration_id, o.name AS org_name
    FROM devices d
    JOIN organizations o ON d.organization_id = o.id
    WHERE (d.name ILIKE '%0AB259CFD040%'
       OR d.serial_number ILIKE '%0AB259CFD040%'
       OR d.external_device_id ILIKE '%0AB259CFD040%')
      AND d.organization_id != v_vmark_org_id  -- Only move if not already in V-Mark
  LOOP
    RAISE NOTICE 'Moving device "%" (%) [serial: %, ext_id: %] from "%" to V-Mark',
      v_hub.name, v_hub.id, v_hub.serial_number, v_hub.external_device_id, v_hub.org_name;

    UPDATE devices
    SET organization_id = v_vmark_org_id,
        integration_id = v_vmark_mqtt_int_id,
        updated_at = now()
    WHERE id = v_hub.id;

    v_updated := v_updated + 1;
  END LOOP;

  RAISE NOTICE 'Moved % hub device(s) to V-Mark', v_updated;

  -- List all 0AB259CFD040 devices and their current state
  FOR v_hub IN
    SELECT d.id, d.name, d.serial_number, d.external_device_id,
           d.organization_id, d.integration_id,
           o.name AS org_name, di.name AS int_name
    FROM devices d
    JOIN organizations o ON d.organization_id = o.id
    LEFT JOIN device_integrations di ON d.integration_id = di.id
    WHERE d.name ILIKE '%0AB259CFD040%'
       OR d.serial_number ILIKE '%0AB259CFD040%'
       OR d.external_device_id ILIKE '%0AB259CFD040%'
  LOOP
    RAISE NOTICE 'Hub device "%" (%) [serial: %] -> org "%" integration "%"',
      v_hub.name, v_hub.id, v_hub.serial_number, v_hub.org_name, v_hub.int_name;
  END LOOP;

  -- Also list V-Mark MQTT devices for reference
  FOR v_hub IN
    SELECT d.id, d.name, d.organization_id, d.integration_id,
           o.name AS org_name, di.name AS int_name
    FROM devices d
    JOIN organizations o ON d.organization_id = o.id
    LEFT JOIN device_integrations di ON d.integration_id = di.id
    WHERE d.organization_id = v_vmark_org_id
      AND d.name ILIKE '%MQTT%'
  LOOP
    RAISE NOTICE 'V-Mark MQTT device "%" (%) -> integration "%"',
      v_hub.name, v_hub.id, v_hub.int_name;
  END LOOP;
END $$;
