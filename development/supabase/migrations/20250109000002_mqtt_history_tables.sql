-- ============================================================================
-- MQTT Data Persistence: Simplified Telemetry History
-- ============================================================================
-- ARCHITECTURE DECISION:
-- - Use integration_activity_log for ALL high-level MQTT events
--   (device discovered, status changes, connection events, message summaries)
-- - Use THIS table ONLY for time-series telemetry analytics
--   (temperature over time, battery trends, signal strength charts)
--
-- WHY THIS APPROACH:
-- - Avoids duplication with existing activity_log infrastructure
-- - Telemetry table optimized for time-series queries only
-- - Simpler queries, better performance, less storage
-- ============================================================================

-- ============================================================================
-- 1. DEVICE TELEMETRY HISTORY (Time-Series Data ONLY)
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_telemetry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Device Reference
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Telemetry Data (optimized for charts/analytics)
  telemetry JSONB NOT NULL, -- { temperature: 22.5, humidity: 65, battery: 87 }
  
  -- Link to activity log entry (optional) - FK constraint added in later migration
  activity_log_id UUID,
  
  -- Timestamps
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When we received it
  device_timestamp TIMESTAMPTZ, -- Timestamp from device (if available)
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for time-series queries
CREATE INDEX idx_telemetry_device_time ON device_telemetry_history(device_id, received_at DESC);
CREATE INDEX idx_telemetry_org_time ON device_telemetry_history(organization_id, received_at DESC);
CREATE INDEX idx_telemetry_device_timestamp ON device_telemetry_history(device_id, device_timestamp DESC) WHERE device_timestamp IS NOT NULL;

-- GIN index for JSONB queries (search by telemetry field)
CREATE INDEX idx_telemetry_data_gin ON device_telemetry_history USING GIN (telemetry);

-- Note: Partial index for recent data removed - NOW() is not immutable and can't be used in index predicates
-- The regular time-based indexes above will serve recent data queries efficiently

-- ============================================================================
-- 2. HELPER FUNCTIONS
-- ============================================================================

-- Function to insert telemetry (called from MQTT listener)
CREATE OR REPLACE FUNCTION record_device_telemetry(
  p_device_id UUID,
  p_organization_id UUID,
  p_telemetry JSONB,
  p_device_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_activity_log_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_new_id UUID;
BEGIN
  -- Insert telemetry record
  INSERT INTO device_telemetry_history (
    device_id,
    organization_id,
    telemetry,
    device_timestamp,
    activity_log_id
  ) VALUES (
    p_device_id,
    p_organization_id,
    p_telemetry,
    COALESCE(p_device_timestamp, NOW()),
    p_activity_log_id
  ) RETURNING id INTO v_new_id;
  
  -- Update device last_seen and cache latest telemetry
  UPDATE devices
  SET 
    last_seen = NOW(),
    updated_at = NOW(),
    metadata = CASE
      WHEN metadata IS NULL THEN jsonb_build_object('last_telemetry', p_telemetry)
      ELSE metadata || jsonb_build_object('last_telemetry', p_telemetry)
    END
  WHERE id = p_device_id;
  
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. DATA RETENTION POLICIES
-- ============================================================================

-- Function to cleanup old telemetry (run via pg_cron)
-- Keep last 90 days by default, longer for compliance industries
CREATE OR REPLACE FUNCTION cleanup_old_telemetry(p_retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM device_telemetry_history
  WHERE received_at < NOW() - (p_retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE device_telemetry_history ENABLE ROW LEVEL SECURITY;

-- Read telemetry for your organization
CREATE POLICY "org_members_view_telemetry" ON device_telemetry_history
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );

-- Insert telemetry (for MQTT listener service)
CREATE POLICY "service_insert_telemetry" ON device_telemetry_history
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses this anyway

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON device_telemetry_history TO authenticated;
GRANT INSERT ON device_telemetry_history TO service_role;
GRANT ALL ON device_telemetry_history TO service_role; -- For cleanup function

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================

COMMENT ON TABLE device_telemetry_history IS 'Lightweight time-series storage for device telemetry. Use integration_activity_log for event tracking.';
COMMENT ON COLUMN device_telemetry_history.activity_log_id IS 'Links to integration_activity_log entry for full context';
COMMENT ON FUNCTION record_device_telemetry IS 'Insert telemetry and update device last_seen. Called from MQTT listener.';
COMMENT ON FUNCTION cleanup_old_telemetry IS 'Delete old telemetry data to manage storage. Run via pg_cron.';

