-- ============================================================================
-- Simplify RLS Policy for device_telemetry_history
-- ============================================================================
-- The previous policy was causing 500 errors due to subquery complexity
-- Use a simpler approach: check organization_id directly
-- ============================================================================

-- Drop the complex policy
DROP POLICY IF EXISTS "Users can read telemetry for their org devices" ON device_telemetry_history;

-- Create a simpler, more performant policy
-- Users can read telemetry if they belong to the organization
CREATE POLICY "Users read telemetry for their organizations"
  ON device_telemetry_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM organization_members 
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = device_telemetry_history.organization_id
    )
  );

-- Add index to speed up the policy check
CREATE INDEX IF NOT EXISTS idx_telemetry_org_id 
  ON device_telemetry_history(organization_id);

-- Verify the policy exists
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'device_telemetry_history'
  AND policyname = 'Users read telemetry for their organizations';
