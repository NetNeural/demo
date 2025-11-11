-- Migration: Add super admin user to all organizations
-- Purpose: Allow super admins to access all organizations through organization_members
-- Date: 2025-11-11

-- =====================================================
-- STEP 1: Ensure all users have membership in their primary org
-- =====================================================

-- Add missing organization_members entries for users who have a primary org
-- but no membership entry for that org
INSERT INTO organization_members (organization_id, user_id, role, joined_at)
SELECT 
  u.organization_id,
  u.id,
  CASE 
    WHEN u.role = 'super_admin' THEN 'owner'
    WHEN u.role IN ('org_admin', 'org_owner') THEN 'admin'
    ELSE 'member'
  END as role,
  u.created_at  -- Use their account creation date as join date
FROM users u
WHERE u.organization_id IS NOT NULL
  AND NOT EXISTS (
    -- Only insert if membership doesn't exist
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = u.organization_id 
    AND om.user_id = u.id
  )
ON CONFLICT (organization_id, user_id) DO UPDATE
SET role = EXCLUDED.role, joined_at = EXCLUDED.joined_at;

-- =====================================================
-- STEP 2: Add super admin to all existing organizations
-- =====================================================

-- Insert super admin into organization_members for all organizations
-- This allows them to switch between and manage all orgs
INSERT INTO organization_members (organization_id, user_id, role, joined_at)
SELECT 
  o.id,
  u.id,
  'owner',  -- Give owner role to super admins
  NOW()
FROM organizations o
CROSS JOIN users u
WHERE u.role = 'super_admin'
  AND NOT EXISTS (
    -- Don't insert if membership already exists
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = o.id 
    AND om.user_id = u.id
  )
ON CONFLICT (organization_id, user_id) DO UPDATE
SET role = 'owner', joined_at = NOW();

-- =====================================================
-- Verification query (commented out for migration)
-- =====================================================
-- Run this manually to verify:
/*
-- Check super admin memberships
SELECT 
  u.email,
  u.role,
  o.name as organization_name,
  om.role as membership_role,
  om.joined_at
FROM users u
JOIN organization_members om ON om.user_id = u.id
JOIN organizations o ON o.id = om.organization_id
WHERE u.role = 'super_admin'
ORDER BY u.email, o.name;

-- Check that all users have membership in their primary org
SELECT 
  u.email,
  (SELECT name FROM organizations WHERE id = u.organization_id) as primary_org,
  EXISTS(
    SELECT 1 FROM organization_members om 
    WHERE om.user_id = u.id AND om.organization_id = u.organization_id
  ) as has_membership
FROM users u
WHERE u.organization_id IS NOT NULL;
*/
