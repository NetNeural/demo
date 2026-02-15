-- Emergency RLS Fix for Staging - Eliminates ALL circular dependencies
-- Date: 2026-02-14
-- Issue: Users table policies that query users table cause infinite recursion

BEGIN;

-- Drop ALL existing policies on users table
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Super admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view org members" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Super admins can manage all users" ON users;
DROP POLICY IF EXISTS "Org admins can manage org users" ON users;
DROP POLICY IF EXISTS "Service role full access on users" ON users;

-- Also drop any older policies that might still exist
DROP POLICY IF EXISTS "Super admins can manage all users" ON users;
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;
DROP POLICY IF EXISTS "Org admins can manage users in their organization" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- Create SIMPLE, NON-RECURSIVE policies (skip if they already exist)

-- 1. ANY authenticated user can read their own row (critical for login)
--    This uses auth.uid() directly - no table queries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'authenticated_users_read_own_profile'
  ) THEN
    CREATE POLICY "authenticated_users_read_own_profile"
      ON users FOR SELECT
      TO authenticated
      USING (id = auth.uid());
  END IF;
END $$;

-- 2. ANY authenticated user can update their own row
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'authenticated_users_update_own_profile'
  ) THEN
    CREATE POLICY "authenticated_users_update_own_profile"
      ON users FOR UPDATE
      TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- 3. Service role has full access (for backend/admin operations)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'service_role_full_access'
  ) THEN
    CREATE POLICY "service_role_full_access"
      ON users FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- That's it! No complex checks, no subqueries, no circular dependencies.
-- Super admin functionality can be handled at the application layer or via service role.

COMMIT;

-- Verification query (run this after applying)
-- This should show the 3 simple policies:
-- SELECT tablename, policyname, roles FROM pg_policies WHERE tablename = 'users';
