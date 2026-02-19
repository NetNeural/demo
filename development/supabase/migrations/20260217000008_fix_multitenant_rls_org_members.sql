-- =====================================================
-- FIX: Multi-tenant RLS to use organization_members table
-- =====================================================
-- Problem: Migration 20260217000003 created RLS policies that only
-- check users.organization_id (single value), ignoring the
-- organization_members table. This means:
--   1. Users can't see devices in orgs they're members of
--   2. Super admins can't see devices in any org except their default
--
-- Fix: Replace single-org policies with policies that check
-- organization_members for multi-org access + super_admin bypass
-- =====================================================

-- =====================================================
-- STEP 1: Drop broken single-org policies from 20260217000003
-- =====================================================

DROP POLICY IF EXISTS "devices_select_own_org" ON devices;
DROP POLICY IF EXISTS "alerts_select_own_org" ON alerts;
DROP POLICY IF EXISTS "organizations_select_own" ON organizations;

-- =====================================================
-- STEP 2: Create proper multi-org RLS policies
-- =====================================================

-- DEVICES: Super admins see all devices
CREATE POLICY "devices_select_super_admin"
  ON devices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

-- DEVICES: Users see devices in any org they're a member of
CREATE POLICY "devices_select_org_member"
  ON devices
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- ALERTS: Super admins see all alerts
CREATE POLICY "alerts_select_super_admin"
  ON alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

-- ALERTS: Users see alerts in any org they're a member of
CREATE POLICY "alerts_select_org_member"
  ON alerts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- ORGANIZATIONS: Super admins see all organizations
CREATE POLICY "organizations_select_super_admin"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

-- ORGANIZATIONS: Users see orgs they're a member of
CREATE POLICY "organizations_select_member"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- =====================================================
-- STEP 3: Verify final state
-- =====================================================
SELECT
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('devices', 'alerts', 'organizations')
ORDER BY tablename, policyname;
