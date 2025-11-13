-- COMPREHENSIVE PRODUCTION DIAGNOSTIC
-- Run ALL of this in Supabase Studio SQL Editor and share ALL results

-- ==================================================================
-- 1. HOW MANY DEVICES EXIST IN TES ORG?
-- ==================================================================
SELECT 
  COUNT(*) as total_devices,
  COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_devices,
  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as soft_deleted_devices
FROM devices
WHERE organization_id = '11ec1e5c-a9df-4313-8ca3-15675f35f673';

-- ==================================================================
-- 2. LIST ALL DEVICES IN TES ORG
-- ==================================================================
SELECT 
  id,
  name,
  device_type,
  status,
  deleted_at IS NOT NULL as is_deleted
FROM devices
WHERE organization_id = '11ec1e5c-a9df-4313-8ca3-15675f35f673'
ORDER BY created_at DESC
LIMIT 10;

-- ==================================================================
-- 3. SUPER ADMIN USER INFO
-- ==================================================================
SELECT 
  id,
  email,
  role,
  organization_id,
  (SELECT name FROM organizations WHERE id = users.organization_id) as primary_org_name
FROM users
WHERE email = 'kaidream78@gmail.com';

-- ==================================================================
-- 4. SUPER ADMIN ORGANIZATION MEMBERSHIPS
-- ==================================================================
SELECT 
  o.id,
  o.name,
  om.role as membership_role,
  o.is_active
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
WHERE om.user_id = (SELECT id FROM users WHERE email = 'kaidream78@gmail.com')
ORDER BY o.name;

-- ==================================================================
-- 5. TEST RLS AS AUTHENTICATED USER (SIMULATES EDGE FUNCTION)
-- ==================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "d17ea1bd-a26f-44fa-93fb-fd2fbffeb9b0", "role": "authenticated"}';

-- Test: Can authenticated user see devices in Tes Org?
SELECT 
  COUNT(*) as devices_visible_through_rls
FROM devices
WHERE organization_id = '11ec1e5c-a9df-4313-8ca3-15675f35f673'
  AND deleted_at IS NULL;

RESET ROLE;

-- ==================================================================
-- 6. CHECK RLS POLICIES ON DEVICES TABLE
-- ==================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'devices'
ORDER BY policyname;
