-- Alternative: More permissive INSERT policy for alerts
-- Use this if the organization_id check isn't working

-- First, check what's blocking insertion
-- Run the verification script first to see existing policies

-- Option 1: Drop ALL old policies and recreate fresh
DO $$ 
BEGIN
  -- Drop all existing alert policies
  DROP POLICY IF EXISTS "Super admins can manage all alerts" ON alerts;
  DROP POLICY IF EXISTS "Organization members can view their alerts" ON alerts;
  DROP POLICY IF EXISTS "Org users can manage their alerts" ON alerts;
  DROP POLICY IF EXISTS "alerts_select_authenticated" ON alerts;
  DROP POLICY IF EXISTS "alerts_update_authenticated" ON alerts;
  DROP POLICY IF EXISTS "Users can insert alerts for their organization" ON alerts;
  DROP POLICY IF EXISTS "Users can update alerts in their organization" ON alerts;
  DROP POLICY IF EXISTS "Users can delete alerts in their organization" ON alerts;
END $$;

-- Create new, simpler policies
CREATE POLICY "Authenticated users can view alerts"
  ON alerts 
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert alerts"
  ON alerts 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update alerts"
  ON alerts 
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can delete alerts"
  ON alerts 
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('org_admin', 'org_owner', 'super_admin')
    )
  );

-- Verify new policies
SELECT 
  policyname,
  cmd,
  SUBSTRING(qual::text, 1, 50) as using_clause,
  SUBSTRING(with_check::text, 1, 50) as with_check_clause
FROM pg_policies 
WHERE tablename = 'alerts'
ORDER BY policyname;
