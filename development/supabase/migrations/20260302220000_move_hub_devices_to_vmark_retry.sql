-- Fix: Move MQTT hub devices from NetNeural to V-Mark (retry)
-- Previous migration 20260302210000 ran but found 0 matches.
-- This ensures devices with '0AB259CFD040' in their name get moved.

DO $$
DECLARE
  v_vmark_org_id UUID;
  v_vmark_mqtt_int_id UUID;
  v_device RECORD;
  v_moved INTEGER := 0;
BEGIN
  SELECT id INTO v_vmark_org_id
  FROM organizations WHERE name ILIKE '%v-mark%' LIMIT 1;

  IF v_vmark_org_id IS NULL THEN
    RAISE NOTICE 'V-Mark org not found'; RETURN;
  END IF;

  SELECT id INTO v_vmark_mqtt_int_id
  FROM device_integrations
  WHERE organization_id = v_vmark_org_id
    AND (integration_type ILIKE '%mqtt%' OR name ILIKE '%mqtt%')
    AND status = 'active'
  LIMIT 1;

  IF v_vmark_mqtt_int_id IS NULL THEN
    RAISE NOTICE 'No MQTT integration in V-Mark'; RETURN;
  END IF;

  RAISE NOTICE 'V-Mark org=%, mqtt_int=%', v_vmark_org_id, v_vmark_mqtt_int_id;

  -- Move all MQTT hub-related devices from NetNeural to V-Mark
  FOR v_device IN
    SELECT d.id, d.name, d.serial_number, d.external_device_id,
           d.organization_id, o.name AS org_name
    FROM devices d
    JOIN organizations o ON d.organization_id = o.id
    WHERE d.organization_id != v_vmark_org_id
      AND (d.name ILIKE '%0AB259CFD040%'
        OR d.serial_number ILIKE '%0AB259CFD040%'
        OR d.external_device_id ILIKE '%0AB259CFD040%')
  LOOP
    UPDATE devices
    SET organization_id = v_vmark_org_id,
        integration_id = v_vmark_mqtt_int_id,
        updated_at = now()
    WHERE id = v_device.id;

    v_moved := v_moved + 1;
    RAISE NOTICE 'Moved "%" (%) from "%" to V-Mark',
      v_device.name, v_device.id, v_device.org_name;
  END LOOP;

  -- Also move MQTT Device 2400390030314701 (same device name pattern)
  FOR v_device IN
    SELECT d.id, d.name, d.organization_id, o.name AS org_name
    FROM devices d
    JOIN organizations o ON d.organization_id = o.id
    WHERE d.organization_id != v_vmark_org_id
      AND d.name ILIKE '%2400390030314701%'
  LOOP
    UPDATE devices
    SET organization_id = v_vmark_org_id,
        integration_id = v_vmark_mqtt_int_id,
        updated_at = now()
    WHERE id = v_device.id;

    v_moved := v_moved + 1;
    RAISE NOTICE 'Moved "%" (%) from "%" to V-Mark',
      v_device.name, v_device.id, v_device.org_name;
  END LOOP;

  RAISE NOTICE 'Total moved: % device(s)', v_moved;

  -- Report final state
  FOR v_device IN
    SELECT d.id, d.name, o.name AS org_name, di.name AS int_name
    FROM devices d
    JOIN organizations o ON d.organization_id = o.id
    LEFT JOIN device_integrations di ON d.integration_id = di.id
    WHERE d.name ILIKE '%0AB259CFD040%'
       OR d.name ILIKE '%2400390030314701%'
       OR (d.organization_id = v_vmark_org_id AND d.name ILIKE '%MQTT%')
  LOOP
    RAISE NOTICE 'Final: "%" (%) -> org="%" int="%"',
      v_device.name, v_device.id, v_device.org_name, v_device.int_name;
  END LOOP;
END $$;
