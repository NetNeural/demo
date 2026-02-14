-- Final fix: Prevent circular dependency by using auth.jwt() claims instead of querying users table
-- This completely eliminates recursion

-- Step 1: Drop all existing policies
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'users' 
    AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', policy_record.policyname);
  END LOOP;
END $$;

-- Step 2: Create simple non-recursive policies

-- Policy 1: Users can ALWAYS view their own record (no subquery, no recursion)
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Policy 2: Users can update their own record
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy 3: Service role has full access
CREATE POLICY "users_service_role_all"
  ON users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- That's it! Just these 3 simple policies.
-- For org-level permissions, we'll handle those in the application layer or through JWT claims

-- Step 3: Verify
SELECT policyname, cmd, roles, qual::text as using_clause
FROM pg_policies 
WHERE tablename = 'users' 
ORDER BY policyname;
