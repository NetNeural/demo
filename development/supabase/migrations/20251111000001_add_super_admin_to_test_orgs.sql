-- Migration: Add super admin user to all organizations
-- Purpose: Allow super admins to access all organizations through organization_members
-- Date: 2025-11-11

-- =====================================================
-- Add super admin to all existing organizations
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
  );

-- =====================================================
-- Verification query (commented out for migration)
-- =====================================================
-- Run this manually to verify:
/*
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
*/
