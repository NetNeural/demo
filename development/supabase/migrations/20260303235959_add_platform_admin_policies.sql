-- Migration: Add platform_admin RLS policies and helper function
-- Platform admins have same powers as super_admin EXCEPT cross-org visibility

-- Helper function to check if a user is a platform-level admin
CREATE OR REPLACE FUNCTION is_platform_level_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'platform_admin')
  );
$$;

-- Drop existing policies first to make idempotent
DROP POLICY IF EXISTS "platform_admin_view_org_users" ON users;
DROP POLICY IF EXISTS "platform_admin_update_org_users" ON users;
DROP POLICY IF EXISTS "platform_admin_view_org_devices" ON devices;
DROP POLICY IF EXISTS "platform_admin_manage_org_devices" ON devices;
DROP POLICY IF EXISTS "platform_admin_view_org_alerts" ON alerts;
DROP POLICY IF EXISTS "platform_admin_manage_org_alerts" ON alerts;
DROP POLICY IF EXISTS "platform_admin_view_member_orgs" ON organizations;
DROP POLICY IF EXISTS "platform_admin_manage_member_orgs" ON organizations;
DROP POLICY IF EXISTS "platform_admin_view_org_members" ON organization_members;

-- Platform admins can see users in their member organizations
CREATE POLICY "platform_admin_view_org_users" ON users
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'platform_admin'
    AND organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Platform admins can update users in their member organizations
CREATE POLICY "platform_admin_update_org_users" ON users
  FOR UPDATE
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'platform_admin'
    AND organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Platform admins can view devices in their member organizations
CREATE POLICY "platform_admin_view_org_devices" ON devices
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'platform_admin'
    AND organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Platform admins can manage devices in their member organizations
CREATE POLICY "platform_admin_manage_org_devices" ON devices
  FOR ALL
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'platform_admin'
    AND organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Platform admins can view alerts in their member organizations
CREATE POLICY "platform_admin_view_org_alerts" ON alerts
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'platform_admin'
    AND organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Platform admins can manage alerts in their member organizations
CREATE POLICY "platform_admin_manage_org_alerts" ON alerts
  FOR ALL
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'platform_admin'
    AND organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Platform admins can view organizations they are members of
CREATE POLICY "platform_admin_view_member_orgs" ON organizations
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'platform_admin'
    AND id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Platform admins can manage organizations they are members of
CREATE POLICY "platform_admin_manage_member_orgs" ON organizations
  FOR UPDATE
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'platform_admin'
    AND id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Platform admins can view organization members for their orgs
CREATE POLICY "platform_admin_view_org_members" ON organization_members
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'platform_admin'
    AND organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
