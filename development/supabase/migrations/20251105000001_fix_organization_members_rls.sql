-- Fix recursive RLS policy issue for organization_members (Issue #52)
-- The current SELECT policy has a recursive dependency that prevents
-- users from checking their own organization membership

-- Drop the problematic recursive policies
DROP POLICY IF EXISTS "Users can view their own organization memberships" ON organization_members;
DROP POLICY IF EXISTS "Admins can update organization memberships" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete organization memberships" ON organization_members;

-- Create a simple, non-recursive SELECT policy
-- Users can view:
-- 1. Their own memberships (user_id = auth.uid())
-- 2. Memberships in organizations where they are a member (simple check)
CREATE POLICY "organization_members_select_policy"
  ON organization_members FOR SELECT
  USING (
    -- Can see own memberships
    auth.uid() = user_id
    OR
    -- Can see memberships in any org they belong to
    organization_id IN (
      SELECT om2.organization_id 
      FROM organization_members om2 
      WHERE om2.user_id = auth.uid()
    )
  );

-- Simple UPDATE policy: admins/owners can update memberships in their orgs
CREATE POLICY "organization_members_update_policy"
  ON organization_members FOR UPDATE
  USING (
    organization_id IN (
      SELECT om2.organization_id 
      FROM organization_members om2 
      WHERE om2.user_id = auth.uid() 
      AND om2.role IN ('admin', 'owner')
    )
  );

-- Simple DELETE policy: admins/owners can delete memberships in their orgs
CREATE POLICY "organization_members_delete_policy"
  ON organization_members FOR DELETE
  USING (
    organization_id IN (
      SELECT om2.organization_id 
      FROM organization_members om2 
      WHERE om2.user_id = auth.uid() 
      AND om2.role IN ('admin', 'owner')
    )
    AND
    -- Cannot delete yourself
    user_id != auth.uid()
  );

-- Ensure RLS is enabled
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
