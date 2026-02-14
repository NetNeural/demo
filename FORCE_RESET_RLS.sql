-- Force reset all RLS policies on users table
-- This will completely remove all existing policies and recreate the correct ones

-- Step 1: Get all policy names (to ensure we drop everything)
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
    RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
  END LOOP;
END $$;

-- Step 2: Create new non-recursive policies

-- 1. Users can ALWAYS view their own record (critical for login)
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- 2. Super admins can view all users (check role directly, no function call)
CREATE POLICY "Super admins can view all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
  );

-- 3. Users can view other users in their organization
CREATE POLICY "Users can view org members"
  ON users FOR SELECT
  USING (
    organization_id IN (
      SELECT u.organization_id 
      FROM users u 
      WHERE u.id = auth.uid()
    )
  );

-- 4. Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- 5. Super admins can manage all users
CREATE POLICY "Super admins can manage all users"
  ON users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
  );

-- 6. Org admins can manage users in their organization
CREATE POLICY "Org admins can manage org users"
  ON users FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id 
      FROM users u 
      WHERE u.id = auth.uid()
      AND u.role IN ('org_admin', 'org_owner')
    )
  );

-- 7. Service role has full access (for backend operations)
CREATE POLICY "Service role full access on users"
  ON users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 3: Verify policies were created
SELECT policyname, cmd, roles, qual::text as using_clause
FROM pg_policies 
WHERE tablename = 'users' 
AND schemaname = 'public'
ORDER BY policyname;
