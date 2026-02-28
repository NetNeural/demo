-- ==========================================
-- User Organization Binding Diagnostic
-- ==========================================
-- Run this in Supabase SQL Editor to check all users

-- 1. Users with their organization assignments
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.organization_id AS user_org_id,
  o.name AS user_org_name,
  u.role AS global_role,
  u.created_at
FROM users u
LEFT JOIN organizations o ON u.organization_id = o.id
ORDER BY u.email;

-- 2. Check organization_members vs users table consistency
SELECT 
  u.email,
  u.full_name,
  u.organization_id AS users_table_org,
  o1.name AS users_table_org_name,
  om.organization_id AS members_table_org,
  o2.name AS members_table_org_name,
  om.role AS org_role,
  CASE 
    WHEN u.organization_id = om.organization_id THEN '✅ Match'
    WHEN u.organization_id IS NULL AND om.organization_id IS NOT NULL THEN '⚠️ User missing org_id'
    WHEN u.organization_id IS NOT NULL AND om.organization_id IS NULL THEN '⚠️ User not in members'
    ELSE '❌ Mismatch'
  END AS status
FROM users u
FULL OUTER JOIN organization_members om ON u.id = om.user_id
LEFT JOIN organizations o1 ON u.organization_id = o1.id
LEFT JOIN organizations o2 ON om.organization_id = o2.id
ORDER BY status DESC, u.email;

-- 3. Users without organization_id
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  om.organization_id AS member_org,
  o.name AS member_org_name,
  om.role AS member_role
FROM users u
LEFT JOIN organization_members om ON u.id = om.user_id
LEFT JOIN organizations o ON om.organization_id = o.id
WHERE u.organization_id IS NULL;

-- 4. Users in organization_members but not users table (should be empty)
SELECT 
  om.user_id,
  om.organization_id,
  o.name AS org_name,
  om.role
FROM organization_members om
LEFT JOIN users u ON om.user_id = u.id
LEFT JOIN organizations o ON om.organization_id = o.id
WHERE u.id IS NULL;

-- 5. Organization member counts
SELECT 
  o.name AS organization,
  o.id,
  COUNT(DISTINCT om.user_id) AS member_count,
  COUNT(DISTINCT CASE WHEN om.role = 'owner' THEN om.user_id END) AS owner_count,
  COUNT(DISTINCT CASE WHEN om.role = 'admin' THEN om.user_id END) AS admin_count,
  COUNT(DISTINCT CASE WHEN om.role = 'user' THEN om.user_id END) AS user_count
FROM organizations o
LEFT JOIN organization_members om ON o.id = om.organization_id
GROUP BY o.id, o.name
ORDER BY o.name;

-- ==========================================
-- FIX SCRIPT (Run if mismatches found)
-- ==========================================

-- Fix users who are members but missing organization_id
-- (Updates users.organization_id to match their first membership)
UPDATE users
SET organization_id = (
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = users.id 
  ORDER BY 
    CASE role 
      WHEN 'owner' THEN 1 
      WHEN 'admin' THEN 2 
      ELSE 3 
    END,
    joined_at
  LIMIT 1
)
WHERE organization_id IS NULL
AND id IN (SELECT user_id FROM organization_members);

-- Verification query (run after fix)
SELECT 
  COUNT(*) FILTER (WHERE organization_id IS NULL) AS users_without_org,
  COUNT(*) FILTER (WHERE organization_id IS NOT NULL) AS users_with_org,
  COUNT(*) AS total_users
FROM users;
