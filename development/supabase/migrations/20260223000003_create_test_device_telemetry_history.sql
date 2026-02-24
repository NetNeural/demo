-- ============================================================================
-- Test Device Telemetry History Table
-- ============================================================================
-- Purpose:
--   Allow authenticated users to write simulated telemetry for test devices
--   without opening write access to production device_telemetry_history.
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_device_telemetry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  telemetry JSONB NOT NULL,

  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_telemetry_device_received
  ON test_device_telemetry_history(device_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_telemetry_org_received
  ON test_device_telemetry_history(organization_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_telemetry_jsonb
  ON test_device_telemetry_history USING GIN (telemetry);

ALTER TABLE test_device_telemetry_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read test telemetry" ON test_device_telemetry_history;
DROP POLICY IF EXISTS "Authenticated users can insert test telemetry" ON test_device_telemetry_history;

CREATE POLICY "Authenticated users can read test telemetry"
  ON test_device_telemetry_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM devices d
      WHERE d.id = test_device_telemetry_history.device_id
        AND d.organization_id = test_device_telemetry_history.organization_id
        AND d.is_test_device = true
    )
    AND (
      EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = test_device_telemetry_history.organization_id
      )
      OR EXISTS (
        SELECT 1
        FROM users u
        WHERE u.id = auth.uid()
          AND u.role = 'super_admin'
      )
    )
  );

CREATE POLICY "Authenticated users can insert test telemetry"
  ON test_device_telemetry_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM devices d
      WHERE d.id = test_device_telemetry_history.device_id
        AND d.organization_id = test_device_telemetry_history.organization_id
        AND d.is_test_device = true
    )
    AND (
      EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = test_device_telemetry_history.organization_id
      )
      OR EXISTS (
        SELECT 1
        FROM users u
        WHERE u.id = auth.uid()
          AND u.role = 'super_admin'
      )
    )
  );

GRANT SELECT, INSERT ON test_device_telemetry_history TO authenticated;
GRANT ALL ON test_device_telemetry_history TO service_role;

COMMENT ON TABLE test_device_telemetry_history IS
  'Telemetry written by interactive test controls for test devices only.';
