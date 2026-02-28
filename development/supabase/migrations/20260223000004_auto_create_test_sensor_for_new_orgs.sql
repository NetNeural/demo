-- Auto-create a default test sensor for new organizations
-- Ensures every newly created org has an immediately usable modular test sensor

CREATE OR REPLACE FUNCTION seed_organization_test_sensor(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_device_id UUID;
BEGIN
  -- Idempotency guard: do not create duplicate default test sensors
  IF EXISTS (
    SELECT 1
    FROM devices
    WHERE organization_id = org_id
      AND is_test_device = true
      AND device_type = 'NetNeural Modular Test Sensor'
      AND deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  INSERT INTO devices (
    organization_id,
    name,
    device_type,
    model,
    status,
    battery_level,
    signal_strength,
    firmware_version,
    location,
    is_test_device,
    external_device_id,
    metadata
  )
  VALUES (
    org_id,
    'NetNeural Modular Test Sensor',
    'NetNeural Modular Test Sensor',
    'NetNeural Modular Test Sensor',
    'online',
    85,
    -55,
    'MODULAR-2.0.0',
    'Test Environment',
    true,
    'auto-test-sensor-' || left(org_id::text, 8),
    jsonb_build_object(
      'is_test_device', true,
      'auto_created', true,
      'auto_created_reason', 'new_organization_provisioning'
    )
  )
  RETURNING id INTO created_device_id;

  -- Seed initial telemetry so key channels render immediately in analytics/views
  INSERT INTO test_device_telemetry_history (
    device_id,
    organization_id,
    telemetry,
    received_at,
    device_timestamp
  )
  VALUES (
    created_device_id,
    org_id,
    jsonb_build_object(
      'temperature', 22,
      'humidity', 45,
      'co2', 600,
      'battery', 85
    ),
    NOW(),
    NOW()
  );

  RAISE NOTICE '✅ Created default test sensor % for organization %', created_device_id, org_id;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_seed_organization_test_sensor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM seed_organization_test_sensor(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_seed_test_sensor_on_org_creation ON organizations;
CREATE TRIGGER auto_seed_test_sensor_on_org_creation
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_organization_test_sensor();

COMMENT ON FUNCTION seed_organization_test_sensor IS 'Seeds a default NetNeural modular test sensor for a newly created organization';
COMMENT ON FUNCTION trigger_seed_organization_test_sensor IS 'Trigger function that auto-creates default test sensor for new organizations';
COMMENT ON TRIGGER auto_seed_test_sensor_on_org_creation ON organizations IS 'Automatically creates a default test sensor when a new organization is created';

GRANT EXECUTE ON FUNCTION seed_organization_test_sensor(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION seed_organization_test_sensor(UUID) TO authenticated;
