-- Fix Alerts RLS Circular Dependency
-- Problem: alerts_select_own_org policy queries users table, creating circular dependency
-- Solution: Use organization_members table + add super_admin bypass

-- Drop existing problematic policy
DROP POLICY IF EXISTS "alerts_select_own_org" ON alerts;

-- Create new policy using organization_members (breaks circular dependency)
CREATE POLICY "alerts_select_org_members"
 ON alerts
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if user is member of the alert's organization
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
    OR
    -- Allow super_admins to see everything
    EXISTS (
      SELECT 1
      FROM users
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Verify policy exists
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'alerts'
ORDER BY policyname;
