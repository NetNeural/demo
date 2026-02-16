-- Emergency fix: Add anon role to alerts policies
-- The client might be using anon key even when user is logged in
-- This adds fallback policies for the anon role

-- Add INSERT for anon role
CREATE POLICY "Anon users can insert alerts"
  ON alerts 
  FOR INSERT 
  TO anon
  WITH CHECK (true);

-- Add SELECT for anon role  
CREATE POLICY "Anon users can view alerts"
  ON alerts 
  FOR SELECT 
  TO anon
  USING (true);

-- Add UPDATE for anon role
CREATE POLICY "Anon users can update alerts"
  ON alerts 
  FOR UPDATE
  TO anon
  USING (true);

-- Verify all policies (should now see both authenticated and anon)
SELECT 
  policyname,
  roles,
  cmd,
  SUBSTRING(qual::text, 1, 50) as using_clause,
  SUBSTRING(with_check::text, 1, 50) as with_check_clause
FROM pg_policies 
WHERE tablename = 'alerts'
ORDER BY cmd, roles;

-- Test user authentication status
SELECT 
  auth.uid() as user_id,
  auth.role() as current_role;
