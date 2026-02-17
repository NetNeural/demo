-- REVERT anonymous access and implement proper multi-tenant RLS
-- For multi-tenant systems, users must authenticate and see only their organization's data

-- Remove anonymous SELECT grants
REVOKE SELECT ON public.devices FROM anon;
REVOKE SELECT ON public.alerts FROM anon;
REVOKE SELECT ON public.organizations FROM anon;

-- Drop anonymous policies
DROP POLICY IF EXISTS "devices_select_anon" ON devices;
DROP POLICY IF EXISTS "organizations_select_anon" ON organizations;

-- Ensure authenticated users can only see devices from their organization
-- First, drop any overly permissive policies
DROP POLICY IF EXISTS "devices_select_authenticated" ON devices;

-- Create organization-scoped policy for devices
CREATE POLICY "devices_select_own_org"
  ON devices
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );

-- Create organization-scoped policy for alerts  
DROP POLICY IF EXISTS "alerts_select_authenticated" ON alerts;

CREATE POLICY "alerts_select_own_org"
  ON alerts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );

-- Organizations: users can only see their own organizations
DROP POLICY IF EXISTS "Organization members can view their org" ON organizations;

CREATE POLICY "organizations_select_own"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );

-- Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('devices', 'alerts', 'organizations')
  AND roles::text LIKE '%authenticated%'
ORDER BY tablename, policyname;
