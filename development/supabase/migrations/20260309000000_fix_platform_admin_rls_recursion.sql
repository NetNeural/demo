-- Migration: Fix infinite recursion in platform_admin RLS policies
-- 
-- Problem: The 9 platform_admin policies created in 20260303235959 use inline
-- subqueries like "(SELECT role FROM users WHERE id = auth.uid()) = 'platform_admin'"
-- On the users table this creates infinite recursion because the policy on users
-- queries users. The org membership subqueries also cause recursion on
-- organization_members. Even on OTHER tables, the inline subquery hits the users
-- table whose own policies cause recursion.
--
-- Fix: Use two SECURITY DEFINER functions that bypass RLS:
--   1. is_platform_level_user() - checks role (already existed, but wasn't used)
--   2. get_user_org_ids() - returns the user's organization memberships

-- ============================================================================
-- 1. Ensure helper functions exist (SECURITY DEFINER = bypasses RLS)
-- ============================================================================
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

CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid();
$$;

-- ============================================================================
-- 2. Drop all 9 problematic policies
-- ============================================================================
DROP POLICY IF EXISTS "platform_admin_view_org_users" ON users;
DROP POLICY IF EXISTS "platform_admin_update_org_users" ON users;
DROP POLICY IF EXISTS "platform_admin_view_org_devices" ON devices;
DROP POLICY IF EXISTS "platform_admin_manage_org_devices" ON devices;
DROP POLICY IF EXISTS "platform_admin_view_org_alerts" ON alerts;
DROP POLICY IF EXISTS "platform_admin_manage_org_alerts" ON alerts;
DROP POLICY IF EXISTS "platform_admin_view_member_orgs" ON organizations;
DROP POLICY IF EXISTS "platform_admin_manage_member_orgs" ON organizations;
DROP POLICY IF EXISTS "platform_admin_view_org_members" ON organization_members;

-- ============================================================================
-- 3. Recreate policies using SECURITY DEFINER functions (no recursion)
-- ============================================================================

-- Users: platform admins can see users in their orgs
CREATE POLICY "platform_admin_view_org_users" ON users
  FOR SELECT USING (is_platform_level_user() AND organization_id IN (SELECT get_user_org_ids()));

-- Users: platform admins can update users in their orgs
CREATE POLICY "platform_admin_update_org_users" ON users
  FOR UPDATE USING (is_platform_level_user() AND organization_id IN (SELECT get_user_org_ids()));

-- Devices: platform admins can view devices in their orgs
CREATE POLICY "platform_admin_view_org_devices" ON devices
  FOR SELECT USING (is_platform_level_user() AND organization_id IN (SELECT get_user_org_ids()));

-- Devices: platform admins can manage devices in their orgs
CREATE POLICY "platform_admin_manage_org_devices" ON devices
  FOR ALL USING (is_platform_level_user() AND organization_id IN (SELECT get_user_org_ids()));

-- Alerts: platform admins can view alerts in their orgs
CREATE POLICY "platform_admin_view_org_alerts" ON alerts
  FOR SELECT USING (is_platform_level_user() AND organization_id IN (SELECT get_user_org_ids()));

-- Alerts: platform admins can manage alerts in their orgs
CREATE POLICY "platform_admin_manage_org_alerts" ON alerts
  FOR ALL USING (is_platform_level_user() AND organization_id IN (SELECT get_user_org_ids()));

-- Organizations: platform admins can view orgs they belong to
CREATE POLICY "platform_admin_view_member_orgs" ON organizations
  FOR SELECT USING (is_platform_level_user() AND id IN (SELECT get_user_org_ids()));

-- Organizations: platform admins can update orgs they belong to
CREATE POLICY "platform_admin_manage_member_orgs" ON organizations
  FOR UPDATE USING (is_platform_level_user() AND id IN (SELECT get_user_org_ids()));

-- Organization members: platform admins can view members in their orgs
CREATE POLICY "platform_admin_view_org_members" ON organization_members
  FOR SELECT USING (is_platform_level_user() AND organization_id IN (SELECT get_user_org_ids()));
