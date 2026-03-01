-- Fix V-Mark MQTT device identifiers and deduplicate
-- Problem 1: Most devices have NULL serial_number and external_device_id
-- Problem 2: "MQTT Device 2400390030314701" is a duplicate of "V-Mark MQTT Temperature Sensor"
-- Problem 3: "MQTT Device 0AB259CFD040" may duplicate "V-Mark MQTT Hub/Gateway"

DO $$
DECLARE
  vmark_org UUID := 'ba3e1c1e-e9ba-4d36-aec5-b25132bdc642';
  vmark_mqtt_int UUID := '4cb3e31e-71ab-4c5c-a5e2-9a7fcd92cb21';
  rec RECORD;
  device_identifier TEXT;
  updated_count INT := 0;
  deleted_count INT := 0;
BEGIN
  -- =====================================================
  -- Step 1: Remove duplicate "MQTT Device" records
  -- =====================================================
  -- "MQTT Device 2400390030314701" (9307a117) duplicates
  -- "V-Mark MQTT Temperature Sensor" (20ed9aec) which already has serial=2400390030314701
  RAISE NOTICE '=== Step 1: Remove duplicate devices ===';
  
  -- Delete MQTT Device 2400390030314701 (duplicate of temp sensor)
  DELETE FROM devices 
  WHERE id = '9307a117-e076-4cc9-b897-a088beffce6b'
    AND name = 'MQTT Device 2400390030314701'
    AND organization_id = vmark_org;
  IF FOUND THEN
    deleted_count := deleted_count + 1;
    RAISE NOTICE 'Deleted duplicate "MQTT Device 2400390030314701" (9307a117)';
  END IF;

  -- Delete MQTT Device 0AB259CFD040 (duplicate of Hub/Gateway)
  -- Only if Hub/Gateway exists
  IF EXISTS (
    SELECT 1 FROM devices 
    WHERE id = 'fad72889-fe43-4277-8101-932e93314091' 
      AND organization_id = vmark_org
  ) THEN
    DELETE FROM devices 
    WHERE id = '00b6a312-565e-4fea-8222-dd3024f70783'
      AND name = 'MQTT Device 0AB259CFD040'
      AND organization_id = vmark_org;
    IF FOUND THEN
      deleted_count := deleted_count + 1;
      RAISE NOTICE 'Deleted duplicate "MQTT Device 0AB259CFD040" (00b6a312)';
    END IF;
  END IF;

  RAISE NOTICE 'Deleted % duplicate device(s)', deleted_count;

  -- =====================================================
  -- Step 2: Fix serial_number and external_device_id
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== Step 2: Fix device identifiers ===';

  -- Fix "MQTT Device XXXX" pattern devices (remaining ones)
  FOR rec IN
    SELECT id, name, serial_number, external_device_id
    FROM devices
    WHERE organization_id = vmark_org
      AND integration_id = vmark_mqtt_int
      AND name LIKE 'MQTT Device %'
  LOOP
    device_identifier := REPLACE(rec.name, 'MQTT Device ', '');
    
    -- Check if this serial_number already exists on another device
    IF NOT EXISTS (
      SELECT 1 FROM devices 
      WHERE serial_number = device_identifier 
        AND id != rec.id
    ) THEN
      UPDATE devices
      SET serial_number = COALESCE(serial_number, device_identifier),
          external_device_id = COALESCE(external_device_id, device_identifier),
          updated_at = NOW()
      WHERE id = rec.id
        AND (serial_number IS NULL OR external_device_id IS NULL);
      
      IF FOUND THEN
        updated_count := updated_count + 1;
        RAISE NOTICE 'Fixed "%" (%) -> serial=%, ext_id=%',
          rec.name, rec.id, 
          COALESCE(rec.serial_number, device_identifier),
          COALESCE(rec.external_device_id, device_identifier);
      END IF;
    ELSE
      -- serial conflict - just set external_device_id
      UPDATE devices
      SET external_device_id = COALESCE(external_device_id, device_identifier),
          updated_at = NOW()
      WHERE id = rec.id
        AND external_device_id IS NULL;
      
      IF FOUND THEN
        updated_count := updated_count + 1;
        RAISE NOTICE 'Fixed "%" (%) -> ext_id=% (serial skipped - conflict)',
          rec.name, rec.id, device_identifier;
      END IF;
    END IF;
  END LOOP;

  -- Fix V-Mark MQTT Temperature Sensor - set external_device_id from serial
  UPDATE devices
  SET external_device_id = COALESCE(external_device_id, serial_number),
      updated_at = NOW()
  WHERE id = '20ed9aec-d260-4a2c-9f2f-365df530dee1'
    AND external_device_id IS NULL
    AND serial_number IS NOT NULL;
  IF FOUND THEN
    updated_count := updated_count + 1;
    RAISE NOTICE 'Fixed V-Mark MQTT Temperature Sensor ext_id = serial';
  END IF;

  -- Fix V-Mark MQTT Hub/Gateway - set serial and ext_id to hub MAC
  IF NOT EXISTS (
    SELECT 1 FROM devices 
    WHERE serial_number = '0AB259CFD040' 
      AND id != 'fad72889-fe43-4277-8101-932e93314091'
  ) THEN
    UPDATE devices
    SET serial_number = COALESCE(serial_number, '0AB259CFD040'),
        external_device_id = COALESCE(external_device_id, '0AB259CFD040'),
        updated_at = NOW()
    WHERE id = 'fad72889-fe43-4277-8101-932e93314091'
      AND (serial_number IS NULL OR external_device_id IS NULL);
    IF FOUND THEN
      updated_count := updated_count + 1;
      RAISE NOTICE 'Fixed V-Mark MQTT Hub/Gateway -> serial/ext_id=0AB259CFD040';
    END IF;
  END IF;

  RAISE NOTICE 'Updated % device(s)', updated_count;

  -- =====================================================
  -- Step 3: Verify final state
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== Final V-Mark MQTT Devices ===';
  
  FOR rec IN
    SELECT d.id, d.name, d.serial_number, d.external_device_id,
           d.last_seen, d.status
    FROM devices d
    WHERE d.organization_id = vmark_org
      AND d.integration_id = vmark_mqtt_int
    ORDER BY d.name
  LOOP
    RAISE NOTICE '  % (%) serial=% ext_id=% last_seen=%',
      rec.name, rec.id, rec.serial_number, rec.external_device_id, rec.last_seen;
  END LOOP;
END $$;
