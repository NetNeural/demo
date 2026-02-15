-- ============================================================================
-- Fix RLS Policies for device_telemetry_history
-- ============================================================================
-- Allow authenticated users to read telemetry data for devices in their org
-- This fixes the issue where the UI can't display telemetry on the devices page
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read telemetry for their org devices" ON device_telemetry_history;
DROP POLICY IF EXISTS "Service role full access to telemetry" ON device_telemetry_history;

-- Policy 1: Allow users to read telemetry for devices in their organization
CREATE POLICY "Users can read telemetry for their org devices"
  ON device_telemetry_history
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy 2: Service role has full access (for edge functions, cron jobs, etc.)
CREATE POLICY "Service role full access to telemetry"
  ON device_telemetry_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verify RLS is enabled
ALTER TABLE device_telemetry_history ENABLE ROW LEVEL SECURITY;

-- Add helpful comment
COMMENT ON TABLE device_telemetry_history IS 
  'Stores all telemetry data from devices across all integrations. ' ||
  'RLS ensures users only see telemetry from their organization''s devices.';
