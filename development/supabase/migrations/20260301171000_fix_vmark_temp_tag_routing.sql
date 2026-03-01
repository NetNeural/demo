-- Fix: Clear serial_number on NetNeural duplicate device 'MQTT Device 2400390030314701'
-- so integration-webhook cross-org fallback routes data to V-Mark Temp tag.

DO $$
DECLARE
  v_vmark_org_id UUID;
  v_dup RECORD;
  v_cleared INTEGER := 0;
BEGIN
  SELECT id INTO v_vmark_org_id
  FROM organizations WHERE name ILIKE '%v-mark%' LIMIT 1;

  IF v_vmark_org_id IS NULL THEN
    RAISE NOTICE 'V-Mark org not found';
    RETURN;
  END IF;

  -- Find V-Mark devices that share a serial_number with a device in another org
  FOR v_dup IN
    SELECT d.id, d.name, d.serial_number, d.organization_id,
           other.id AS other_id, other.name AS other_name,
           o2.name AS other_org_name
    FROM devices d
    JOIN devices other ON other.serial_number = d.serial_number
                      AND other.id != d.id
                      AND other.organization_id != d.organization_id
    JOIN organizations o2 ON other.organization_id = o2.id
    WHERE d.organization_id = v_vmark_org_id
      AND d.serial_number IS NOT NULL
  LOOP
    -- Clear the serial on the OTHER org copy (the duplicate) so webhook
    -- cross-org fallback finds the V-Mark device instead
    UPDATE devices
    SET serial_number = NULL, updated_at = now()
    WHERE id = v_dup.other_id;

    v_cleared := v_cleared + 1;

    RAISE NOTICE 'Cleared serial "%" from duplicate device "%" (%) in org "%" - V-Mark device "%" keeps it',
      v_dup.serial_number, v_dup.other_name, v_dup.other_id,
      v_dup.other_org_name, v_dup.name;
  END LOOP;

  RAISE NOTICE 'Cleared serial on % duplicate device(s)', v_cleared;
END $$;
