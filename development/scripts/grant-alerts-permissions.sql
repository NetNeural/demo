-- Check table permissions and RLS status

-- 1. Check table permissions for different roles
SELECT 
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_name = 'alerts'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee, privilege_type;

-- 2. Check RLS status
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'alerts';

-- 3. Grant necessary permissions if missing
GRANT SELECT, INSERT, UPDATE ON alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON alerts TO anon;
GRANT ALL ON alerts TO service_role;

-- 4. Verify grants were applied
SELECT 
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_name = 'alerts'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee, privilege_type;
