-- Move MQTT Broker Integration from NetNeural to V-Mark
-- The broker at mqtt://142.93.60.126 uses integration_id a6d0e905 in its webhook calls.
-- Since the user wants the integration MOVED (not copied), we:
-- 1. Reassign devices from the copy (4cb3e31e) to the original (a6d0e905)
-- 2. Change the original's org from NetNeural to V-Mark
-- 3. Rename the original (remove "Copy" references)
-- 4. Deactivate the copy integration

DO $$
DECLARE
  v_original_id UUID := 'a6d0e905-0532-4178-9ed0-2aae24a896f6';
  v_copy_id UUID := '4cb3e31e-71ab-4c5c-a5e2-9a7fcd92cb21';
  v_vmark_org UUID := 'ba3e1c1e-e9ba-4d36-aec5-b25132bdc642';
  v_netneural_org UUID := '00000000-0000-0000-0000-000000000001';
  v_count INT;
  rec RECORD;
BEGIN
  -- Verify both integrations exist
  PERFORM 1 FROM device_integrations WHERE id = v_original_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original integration a6d0e905 not found!';
  END IF;

  PERFORM 1 FROM device_integrations WHERE id = v_copy_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Copy integration 4cb3e31e not found!';
  END IF;

  RAISE NOTICE '=== STEP 1: Move devices from copy to original integration ===';

  SELECT count(*) INTO v_count FROM devices WHERE integration_id = v_copy_id;
  RAISE NOTICE 'Devices on copy integration (4cb3e31e): %', v_count;

  FOR rec IN
    SELECT id, name, serial_number FROM devices WHERE integration_id = v_copy_id
  LOOP
    RAISE NOTICE '  Moving: % (%) serial=%', rec.name, rec.id, rec.serial_number;
  END LOOP;

  UPDATE devices
  SET integration_id = v_original_id,
      updated_at = NOW()
  WHERE integration_id = v_copy_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Devices moved to original integration: %', v_count;

  RAISE NOTICE '';
  RAISE NOTICE '=== STEP 2: Move original integration to V-Mark org ===';

  UPDATE device_integrations
  SET organization_id = v_vmark_org,
      name = 'MQTT Broker Integration',
      updated_at = NOW()
  WHERE id = v_original_id;

  RAISE NOTICE 'Integration a6d0e905 moved to V-Mark org';

  RAISE NOTICE '';
  RAISE NOTICE '=== STEP 3: Deactivate the copy integration ===';

  UPDATE device_integrations
  SET status = 'inactive',
      name = 'MQTT Broker Integration (Copy) [DEACTIVATED]',
      webhook_enabled = false,
      updated_at = NOW()
  WHERE id = v_copy_id;

  RAISE NOTICE 'Copy integration 4cb3e31e deactivated';

  UPDATE integration_activity_log
  SET integration_id = v_original_id
  WHERE integration_id = v_copy_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Activity log entries reassigned: %', v_count;

  RAISE NOTICE '';
  RAISE NOTICE '=== STEP 4: Verify final state ===';

  FOR rec IN
    SELECT
      di.id,
      di.name,
      o.name AS org_name,
      di.status,
      di.webhook_enabled,
      (SELECT count(*) FROM devices d WHERE d.integration_id = di.id) AS device_count
    FROM device_integrations di
    JOIN organizations o ON o.id = di.organization_id
    WHERE di.id IN (v_original_id, v_copy_id)
    ORDER BY di.id
  LOOP
    RAISE NOTICE 'Integration: % (%)', rec.name, rec.id;
    RAISE NOTICE '  Org: % | Status: % | Webhook: % | Devices: %',
      rec.org_name, rec.status, rec.webhook_enabled, rec.device_count;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== V-Mark Devices After Move ===';
  FOR rec IN
    SELECT
      d.id, d.name, d.serial_number, d.integration_id, d.last_seen,
      di.name AS int_name
    FROM devices d
    LEFT JOIN device_integrations di ON di.id = d.integration_id
    WHERE d.organization_id = v_vmark_org
    ORDER BY d.name
  LOOP
    RAISE NOTICE 'Device: % serial=% int=%(%)', rec.name, rec.serial_number, rec.int_name, rec.integration_id;
    RAISE NOTICE '  Last Seen: %', rec.last_seen;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== DONE: Broker at mqtt://142.93.60.126 will now route to V-Mark via a6d0e905 ===';
END $$;
