-- Fix circular dependency in users table RLS policies
-- Problem: get_user_role() and get_user_organization_id() query the users table,
-- but the users table policies call these functions, creating infinite recursion

-- Drop existing problematic policies on users table
DROP POLICY IF EXISTS "Super admins can manage all users" ON users;
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;
DROP POLICY IF EXISTS "Org admins can manage users in their organization" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- Create new non-recursive policies

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

-- Note: We keep the helper functions for other tables that don't have circular dependencies
-- They can still be useful for organizations, devices, alerts, etc.
