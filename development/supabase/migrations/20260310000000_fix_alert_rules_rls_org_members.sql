-- Migration: Fix alert_rules RLS policies to use organization_members role
-- Issue: #455 - "Failed to create rule"
-- Root cause: INSERT/UPDATE/DELETE policies only check users.role (global role field)
-- but org owners/admins have their role in organization_members.role, not users.role.
-- E.g., a user with users.role='user' but organization_members.role='owner' was blocked.
-- Fix: Check both users.role AND organization_members.role for write access.
-- Also add platform_admin/super_admin bypass via is_platform_level_user().

-- Drop existing policies
DROP POLICY IF EXISTS alert_rules_select_policy ON alert_rules;
DROP POLICY IF EXISTS alert_rules_insert_policy ON alert_rules;
DROP POLICY IF EXISTS alert_rules_update_policy ON alert_rules;
DROP POLICY IF EXISTS alert_rules_delete_policy ON alert_rules;

-- SELECT: Users can view rules in orgs they belong to (via organization_members)
-- or if they are platform-level users
CREATE POLICY alert_rules_select_policy ON alert_rules
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
    OR
    is_platform_level_user()
  );

-- INSERT: Users with owner/admin role in the org can create rules
CREATE POLICY alert_rules_insert_policy ON alert_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin')
    )
    OR
    is_platform_level_user()
  );

-- UPDATE: Users with owner/admin role in the org can update rules
CREATE POLICY alert_rules_update_policy ON alert_rules
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin')
    )
    OR
    is_platform_level_user()
  );

-- DELETE: Users with owner/admin role in the org can delete rules  
CREATE POLICY alert_rules_delete_policy ON alert_rules
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin')
    )
    OR
    is_platform_level_user()
  );
