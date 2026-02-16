-- Verify alerts table RLS policies
-- Run this to check current policy configuration

-- 1. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'alerts';

-- 2. List all current policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  SUBSTRING(qual::text, 1, 100) as using_clause,
  SUBSTRING(with_check::text, 1, 100) as with_check_clause
FROM pg_policies 
WHERE tablename = 'alerts'
ORDER BY policyname;

-- 3. Check if the INSERT policy exists
SELECT COUNT(*) as insert_policy_count
FROM pg_policies 
WHERE tablename = 'alerts' 
  AND cmd = 'INSERT';

-- 4. Test the policy logic (returns your organization_id if it would work)
SELECT 
  auth.uid() as current_user_id,
  organization_id as user_org_id
FROM users 
WHERE id = auth.uid();
