-- Diagnostic script: Check multi-tenant setup for demo site
-- Run this in Supabase SQL Editor to verify everything is configured correctly

-- 1. Check if test users exist and have organizations assigned
SELECT 
  'Test Users' as check_type,
  u.email,
  u.full_name,
  u.role,
  u.organization_id,
  o.name as org_name,
  o.slug as org_slug
FROM users u
LEFT JOIN organizations o ON u.organization_id = o.id
WHERE u.email LIKE '%@netneural.ai'
ORDER BY u.email;

-- 2. Verify RLS policies exist for alerts
SELECT 
  'Alerts RLS Policies' as check_type,
  policyn as policy_name,
  permissive,
  roles,
  cmd as command
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'alerts'
ORDER BY policyname;

-- 3. Verify RLS policies exist for devices
SELECT 
  'Devices RLS Policies' as check_type,
  policyname as policy_name,
  permissive,
  roles,
  cmd as command
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'devices'
ORDER BY policyname;

-- 4. Check alerts data per organization
SELECT 
  'Alerts Per Org' as check_type,
  o.name as org_name,
  COUNT(a.id) as alert_count,
  SUM(CASE WHEN a.is_resolved = false THEN 1 ELSE 0 END) as active_alerts
FROM organizations o
LEFT JOIN alerts a ON a.organization_id = o.id
GROUP BY o.id, o.name
ORDER BY alert_count DESC
LIMIT 10;

-- 5. Verify grants for authenticated role
SELECT 
  'Table Grants' as check_type,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'authenticated'
  AND table_schema = 'public'
  AND table_name IN ('alerts', 'devices', 'organizations')
ORDER BY table_name, privilege_type;
