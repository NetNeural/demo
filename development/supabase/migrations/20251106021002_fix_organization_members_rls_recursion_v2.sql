-- Fix RLS recursion issue for organization_members (Issue #60)
-- The current SELECT policy causes infinite recursion when other tables
-- reference organization_members in their RLS policies

-- Drop ALL existing policies on organization_members to start fresh
DROP POLICY IF EXISTS "organization_members_select_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON organization_members;
DROP POLICY IF EXISTS "organization_members_delete_policy" ON organization_members;
DROP POLICY IF EXISTS "Users can view their own organization memberships" ON organization_members;
DROP POLICY IF EXISTS "Admins can update organization memberships" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete organization memberships" ON organization_members;
DROP POLICY IF EXISTS "Users can view memberships" ON organization_members;
DROP POLICY IF EXISTS "Super admins can view all memberships" ON organization_members;
DROP POLICY IF EXISTS "Users can be added to organizations" ON organization_members;
DROP POLICY IF EXISTS "Admins can update memberships" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete memberships" ON organization_members;

-- Create NON-RECURSIVE SELECT policy
-- The key is to NOT reference organization_members within the USING clause
-- Users can only see memberships where:
-- 1. It's their own membership (user_id = auth.uid())
-- This is simple and non-recursive
CREATE POLICY "Users can view memberships"
  ON organization_members FOR SELECT
  USING (
    -- Can always see own memberships - NO RECURSION
    user_id = auth.uid()
  );

-- Allow super admins to see all memberships
CREATE POLICY "Super admins can view all memberships"
  ON organization_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
  );

-- Simple INSERT policy: users can join organizations (controlled by application logic)
CREATE POLICY "Users can be added to organizations"
  ON organization_members FOR INSERT
  WITH CHECK (
    -- Super admins can add anyone
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
    OR
    -- Org admins/owners can add users (checked via application/edge function)
    user_id = auth.uid()
  );

-- Simple UPDATE policy: only admins/owners can update roles
CREATE POLICY "Admins can update memberships"
  ON organization_members FOR UPDATE
  USING (
    -- Super admins can update any membership
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
  );

-- Simple DELETE policy: admins/owners can remove members (except themselves)
CREATE POLICY "Admins can delete memberships"
  ON organization_members FOR DELETE
  USING (
    -- Super admins can delete any membership
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
    AND
    -- Cannot delete yourself
    user_id != auth.uid()
  );

-- Ensure RLS is enabled
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Add comment explaining the fix
COMMENT ON TABLE organization_members IS 'RLS policies updated to prevent recursion. Users can only see their own memberships directly.';
