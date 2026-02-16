-- Add INSERT policy for alerts table
-- Allows authenticated users to create alerts for devices in their organization
-- Required for test alert functionality

-- Drop existing overly restrictive policies if they exist
DROP POLICY IF EXISTS "Org users can manage their alerts" ON alerts;

-- Create separate INSERT policy
CREATE POLICY "Users can insert alerts for their organization"
  ON alerts 
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );

-- Recreate the update/delete policy (more specific than the old "manage" policy)
CREATE POLICY "Users can update alerts in their organization"
  ON alerts 
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete alerts in their organization"
  ON alerts 
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = auth.uid()
      AND role IN ('org_admin', 'org_owner', 'super_admin')
    )
  );

-- Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'alerts'
ORDER BY policyname;
