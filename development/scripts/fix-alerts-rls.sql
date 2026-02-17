-- Fix RLS policies for alerts table
-- Run this in Supabase SQL Editor to allow users to view alerts

-- First, check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'alerts';

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "alerts_select_authenticated" ON alerts;
DROP POLICY IF EXISTS "alerts_select_own_org" ON alerts;
DROP POLICY IF EXISTS "Users can view alerts for their organization" ON alerts;

-- Create a permissive policy that allows authenticated users to see alerts
-- for organizations they belong to
CREATE POLICY "alerts_select_by_org_membership"
  ON alerts
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if user is a member of the organization
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = alerts.organization_id
      AND om.user_id = auth.uid()
    )
    OR
    -- Allow if user is super admin
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'super_admin'
    )
  );

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'alerts';

-- If RLS is not enabled, enable it
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Test the policy by checking what alerts the current user can see
SELECT 
  COUNT(*) as visible_alerts,
  organization_id,
  severity,
  is_resolved
FROM alerts
GROUP BY organization_id, severity, is_resolved
ORDER BY organization_id, severity;

-- Show organization memberships for debugging
SELECT 
  om.organization_id,
  o.name as org_name,
  om.user_id,
  u.email,
  u.role
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
JOIN users u ON u.id = om.user_id
ORDER BY o.name, u.email;
