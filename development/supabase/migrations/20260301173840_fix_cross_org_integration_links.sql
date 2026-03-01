-- ============================================================================
-- Migration: Fix cross-org integration links + NULL integration devices
-- ============================================================================
-- 1. Re-links devices with cross-org integration mismatches
-- 2. Links devices with NULL integration_id to a matching integration in their org
-- 3. Reports final state
-- ============================================================================

-- 1. Audit current state
DO $$
DECLARE
  device_rec RECORD;
BEGIN
  RAISE NOTICE '=== Cross-Org Integration Link Audit ===';
  
  FOR device_rec IN 
    SELECT 
      d.id AS device_id,
      d.name AS device_name,
      d.organization_id AS device_org,
      d.integration_id,
      di.organization_id AS integration_org,
      di.integration_type,
      di.name AS integration_name,
      o1.name AS device_org_name,
      o2.name AS integration_org_name
    FROM devices d
    JOIN device_integrations di ON d.integration_id = di.id
    JOIN organizations o1 ON d.organization_id = o1.id
    JOIN organizations o2 ON di.organization_id = o2.id
    WHERE d.organization_id != di.organization_id
  LOOP
    RAISE NOTICE 'MISMATCH: Device "%" (%) in org "%" has integration "%" from org "%"',
      device_rec.device_name,
      device_rec.device_id,
      device_rec.device_org_name,
      device_rec.integration_name,
      device_rec.integration_org_name;
  END LOOP;

  FOR device_rec IN
    SELECT 
      d.id AS device_id,
      d.name AS device_name,
      o.name AS org_name
    FROM devices d
    JOIN organizations o ON d.organization_id = o.id
    WHERE d.integration_id IS NULL
  LOOP
    RAISE NOTICE 'NULL INTEGRATION: Device "%" (%) in org "%"',
      device_rec.device_name,
      device_rec.device_id,
      device_rec.org_name;
  END LOOP;
END $$;

-- 2. Fix devices whose integration_id points to wrong org
UPDATE devices d
SET 
  integration_id = matching.id,
  updated_at = now()
FROM device_integrations wrong_int,
     device_integrations matching
WHERE d.integration_id = wrong_int.id
  AND d.organization_id != wrong_int.organization_id
  AND matching.organization_id = d.organization_id
  AND matching.integration_type = wrong_int.integration_type
  AND matching.status = 'active';

-- 3. Fix devices with NULL integration_id — link to an integration in their org
-- For devices whose name contains 'MQTT', prefer an mqtt-type integration
DO $$
DECLARE
  v_device RECORD;
  v_int_id UUID;
  v_fixed INTEGER := 0;
BEGIN
  FOR v_device IN
    SELECT d.id, d.name, d.organization_id, o.name AS org_name
    FROM devices d
    JOIN organizations o ON d.organization_id = o.id
    WHERE d.integration_id IS NULL
  LOOP
    -- Try to match by device name hint (MQTT devices → mqtt integration)
    IF v_device.name ILIKE '%mqtt%' THEN
      SELECT id INTO v_int_id
      FROM device_integrations
      WHERE organization_id = v_device.organization_id
        AND (integration_type ILIKE '%mqtt%' OR name ILIKE '%mqtt%')
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;

    -- Fallback: pick any active integration in the device's org
    IF v_int_id IS NULL THEN
      SELECT id INTO v_int_id
      FROM device_integrations
      WHERE organization_id = v_device.organization_id
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;

    IF v_int_id IS NOT NULL THEN
      UPDATE devices
      SET integration_id = v_int_id, updated_at = now()
      WHERE id = v_device.id;
      v_fixed := v_fixed + 1;
      RAISE NOTICE 'Linked device "%" (%) in "%" → integration %',
        v_device.name, v_device.id, v_device.org_name, v_int_id;
    ELSE
      RAISE NOTICE 'No integration available for device "%" in "%"',
        v_device.name, v_device.org_name;
    END IF;

    v_int_id := NULL;
  END LOOP;

  RAISE NOTICE 'Linked % NULL-integration device(s)', v_fixed;
END $$;

-- 4. Final report
DO $$
DECLARE
  remaining_count INTEGER;
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM devices d
  JOIN device_integrations di ON d.integration_id = di.id
  WHERE d.organization_id != di.organization_id;

  SELECT COUNT(*) INTO null_count
  FROM devices WHERE integration_id IS NULL;

  IF remaining_count > 0 THEN
    RAISE NOTICE 'Still % device(s) with cross-org integration links', remaining_count;
  ELSE
    RAISE NOTICE 'All device integration links are now org-consistent';
  END IF;

  IF null_count > 0 THEN
    RAISE NOTICE 'Still % device(s) with NULL integration_id (no integration available in their org)', null_count;
  ELSE
    RAISE NOTICE 'No devices with NULL integration_id remain';
  END IF;
END $$;
