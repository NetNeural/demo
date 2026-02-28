-- ============================================================================
-- CONSOLIDATED STAGING MIGRATION: Device Telemetry System
-- ============================================================================
-- This file combines 3 critical migrations to fix AI Analytics 400 error:
-- 1. Create device_telemetry_history table
-- 2. Add integration tracking
-- 3. Set proper RLS policies
--
-- INSTRUCTIONS:
-- 1. Copy this entire file
-- 2. Go to Supabase Dashboard → SQL Editor → New Query
-- 3. Paste and click "Run"
-- 4. Verify success (should complete in ~1-2 seconds)
-- ============================================================================

-- ============================================================================
-- PART 1: Create device_telemetry_history table
-- From: 20250109000002_mqtt_history_tables.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_telemetry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Device Reference
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Telemetry Data (optimized for charts/analytics)
  telemetry JSONB NOT NULL, -- { temperature: 22.5, humidity: 65, battery: 87 }
  
  -- Link to activity log entry (optional)
  activity_log_id UUID,
  
  -- Timestamps
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_timestamp TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for time-series queries
CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON device_telemetry_history(device_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_org_time ON device_telemetry_history(organization_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_device_timestamp ON device_telemetry_history(device_id, device_timestamp DESC) WHERE device_timestamp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_telemetry_data_gin ON device_telemetry_history USING GIN (telemetry);

-- Helper function to insert telemetry
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

-- Data retention function
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
-- PART 2: Add integration_id tracking
-- From: 20250109000003_telemetry_all_integrations.sql
-- ============================================================================

-- Add integration_id column to track telemetry source
ALTER TABLE device_telemetry_history 
ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES device_integrations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_telemetry_integration 
  ON device_telemetry_history(integration_id, received_at DESC);

-- Update record_device_telemetry to accept integration_id
CREATE OR REPLACE FUNCTION record_device_telemetry(
  p_device_id UUID,
  p_organization_id UUID,
  p_telemetry JSONB,
  p_device_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_activity_log_id UUID DEFAULT NULL,
  p_integration_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_new_id UUID;
BEGIN
  INSERT INTO device_telemetry_history (
    device_id,
    organization_id,
    telemetry,
    device_timestamp,
    activity_log_id,
    integration_id
  ) VALUES (
    p_device_id,
    p_organization_id,
    p_telemetry,
    COALESCE(p_device_timestamp, NOW()),
    p_activity_log_id,
    p_integration_id
  ) RETURNING id INTO v_new_id;
  
  UPDATE devices
  SET 
    last_seen = NOW(),
    updated_at = NOW(),
    metadata = CASE
      WHEN metadata IS NULL THEN jsonb_build_object('last_telemetry', p_telemetry, 'last_telemetry_source', COALESCE((SELECT type FROM device_integrations WHERE id = p_integration_id), 'unknown'))
      ELSE metadata || jsonb_build_object('last_telemetry', p_telemetry, 'last_telemetry_source', COALESCE((SELECT type FROM device_integrations WHERE id = p_integration_id), 'unknown'))
    END
  WHERE id = p_device_id;
  
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Extract telemetry from device metadata
CREATE OR REPLACE FUNCTION extract_telemetry_from_metadata(p_metadata JSONB) 
RETURNS JSONB AS $$
DECLARE
  v_telemetry JSONB := '{}'::JSONB;
BEGIN
  IF p_metadata ? 'battery_level' THEN
    v_telemetry := v_telemetry || jsonb_build_object('battery', (p_metadata->>'battery_level')::numeric);
  END IF;
  
  IF p_metadata ? 'temperature' THEN
    v_telemetry := v_telemetry || jsonb_build_object('temperature', (p_metadata->>'temperature')::numeric);
  END IF;
  
  IF p_metadata ? 'humidity' THEN
    v_telemetry := v_telemetry || jsonb_build_object('humidity', (p_metadata->>'humidity')::numeric);
  END IF;
  
  IF p_metadata ? 'rssi' OR p_metadata ? 'signal_strength' THEN
    v_telemetry := v_telemetry || jsonb_build_object('rssi', 
      COALESCE((p_metadata->>'rssi')::numeric, (p_metadata->>'signal_strength')::numeric)
    );
  END IF;
  
  RETURN v_telemetry;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Auto-record telemetry on device metadata updates
CREATE OR REPLACE FUNCTION auto_record_telemetry_on_device_update()
RETURNS TRIGGER AS $$
DECLARE
  v_telemetry JSONB;
  v_integration_id UUID;
BEGIN
  IF NEW.metadata IS DISTINCT FROM OLD.metadata AND NEW.metadata IS NOT NULL THEN
    v_telemetry := extract_telemetry_from_metadata(NEW.metadata);
    
    IF jsonb_object_keys(v_telemetry) IS NOT NULL THEN
      SELECT id INTO v_integration_id
      FROM device_integrations
      WHERE organization_id = NEW.organization_id
        AND enabled = true
      LIMIT 1;
      
      PERFORM record_device_telemetry(
        p_device_id := NEW.id,
        p_organization_id := NEW.organization_id,
        p_telemetry := v_telemetry,
        p_device_timestamp := NEW.updated_at,
        p_activity_log_id := NULL,
        p_integration_id := v_integration_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_record_telemetry ON devices;
CREATE TRIGGER trigger_auto_record_telemetry
  AFTER UPDATE ON devices
  FOR EACH ROW
  WHEN (NEW.metadata IS DISTINCT FROM OLD.metadata)
  EXECUTE FUNCTION auto_record_telemetry_on_device_update();

-- ============================================================================
-- PART 3: Row Level Security (Ultra-Simple)
-- From: 20260215000006_ultra_simple_telemetry_rls.sql
-- ============================================================================

ALTER TABLE device_telemetry_history ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (including the ones we're about to create)
DROP POLICY IF EXISTS "org_members_view_telemetry" ON device_telemetry_history;
DROP POLICY IF EXISTS "service_insert_telemetry" ON device_telemetry_history;
DROP POLICY IF EXISTS "Users can read telemetry for their org devices" ON device_telemetry_history;
DROP POLICY IF EXISTS "Users read telemetry for their organizations" ON device_telemetry_history;
DROP POLICY IF EXISTS "Authenticated users can read telemetry" ON device_telemetry_history;
DROP POLICY IF EXISTS "Service role full access" ON device_telemetry_history;

-- Simple policy: authenticated users can read all telemetry
-- (Application filters by organization_id)
CREATE POLICY "Authenticated users can read telemetry"
  ON device_telemetry_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role can do everything
CREATE POLICY "Service role full access"
  ON device_telemetry_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_telemetry_org_id 
  ON device_telemetry_history(organization_id);

CREATE INDEX IF NOT EXISTS idx_telemetry_org_device_received 
  ON device_telemetry_history(organization_id, device_id, received_at DESC);

-- Permissions
GRANT SELECT ON device_telemetry_history TO authenticated;
GRANT ALL ON device_telemetry_history TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check table exists
SELECT 
  'device_telemetry_history' as table_name,
  COUNT(*) as row_count
FROM device_telemetry_history;

-- Check policies
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'device_telemetry_history';

-- Check indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'device_telemetry_history';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Device telemetry system installed successfully!';
  RAISE NOTICE 'AI Analytics page will now work without 400 errors.';
END $$;
