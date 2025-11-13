-- Check if devices exist in Tes Org and verify RLS
-- Run in Supabase Studio SQL Editor

-- 1. Check devices in Tes Org (bypasses RLS with direct query)
SELECT 
  id,
  name,
  device_type,
  status,
  organization_id
FROM devices
WHERE organization_id = '11ec1e5c-a9df-4313-8ca3-15675f35f673'
  AND deleted_at IS NULL;

-- 2. Check super admin user details
SELECT 
  id,
  email,
  role,
  organization_id
FROM users
WHERE email = 'kaidream78@gmail.com';

-- 3. Check super admin memberships
SELECT 
  om.organization_id,
  o.name,
  om.role
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
WHERE om.user_id = (SELECT id FROM users WHERE email = 'kaidream78@gmail.com');

-- 4. Test RLS policy directly - simulating what the edge function sees
-- This should show devices if RLS is working
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "d17ea1bd-a26f-44fa-93fb-fd2fbffeb9b0", "role": "authenticated"}';

SELECT COUNT(*) as device_count
FROM devices
WHERE organization_id = '11ec1e5c-a9df-4313-8ca3-15675f35f673'
  AND deleted_at IS NULL;

RESET ROLE;
