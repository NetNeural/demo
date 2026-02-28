-- Fix User Organization Bindings
-- Run this in Supabase SQL Editor

-- ============================================================================
-- ANALYSIS: Current State
-- ============================================================================
-- Most users have organization_id = NetNeural but are members of other orgs
-- This happens because user creation defaults to NetNeural instead of checking memberships

-- ============================================================================
-- STRATEGY
-- ============================================================================
-- 1. Users with SINGLE membership → Update to that org
-- 2. Users with MULTIPLE memberships → Keep as-is (likely super admins)
-- 3. Users with NO memberships → Keep as NetNeural (test accounts)

-- ============================================================================
-- STEP 1: Review users with single membership mismatch
-- ============================================================================
SELECT 
  u.email,
  u.organization_id as current_org_id,
  o1.name as current_org_name,
  om.organization_id as should_be_org_id,
  o2.name as should_be_org_name,
  'Single membership - should update' as action
FROM users u
JOIN organization_members om ON u.id = om.user_id
LEFT JOIN organizations o1 ON u.organization_id = o1.id
LEFT JOIN organizations o2 ON om.organization_id = o2.id
WHERE u.organization_id != om.organization_id
  AND u.id IN (
    -- Only users with exactly 1 membership
    SELECT user_id 
    FROM organization_members 
    GROUP BY user_id 
    HAVING COUNT(*) = 1
  )
ORDER BY u.email;

-- ============================================================================
-- STEP 2: FIX - Update users with single membership to match
-- ============================================================================
-- UNCOMMENT TO RUN:
/*
UPDATE users u
SET 
  organization_id = om.organization_id,
  updated_at = NOW()
FROM organization_members om
WHERE u.id = om.user_id
  AND u.organization_id != om.organization_id
  AND u.id IN (
    -- Only users with exactly 1 membership
    SELECT user_id 
    FROM organization_members 
    GROUP BY user_id 
    HAVING COUNT(*) = 1
  );
*/

-- ============================================================================
-- SPECIFIC FIXES (Based on your data)
-- ============================================================================

-- Fix Joseph Wolf (Insight)
UPDATE users 
SET organization_id = '94973ea2-b6cb-435c-88e4-62150ac4d6ca', updated_at = NOW()
WHERE email = 'joseph.wolf@insight.com';

-- Heath Scheiman - SKIP (owner in both Volcor and NetNeural, leave as NetNeural)
-- UPDATE users 
-- SET organization_id = '45ac43b6-1ae2-49e9-89c4-d5ba0d2a643f', updated_at = NOW()
-- WHERE email = 'heath.scheiman@netneural.ai';

-- Fix Wiley @ V-Mark
UPDATE users 
SET organization_id = 'ba3e1c1e-e9ba-4d36-aec5-b25132bdc642', updated_at = NOW()
WHERE email = 'wiley@v-mark.com';

-- Fix George @ V-Mark  
UPDATE users 
SET organization_id = 'ba3e1c1e-e9ba-4d36-aec5-b25132bdc642', updated_at = NOW()
WHERE email = 'george@v-mark.com';

-- Fix Lynch (Freeze Frame Films)
UPDATE users 
SET organization_id = '2f9642f4-7ddc-4f21-8681-28366222e170', updated_at = NOW()
WHERE email = 'lynchcj@yahoo.com';

-- Fix Joey Metz (Fides Communication)
UPDATE users 
SET organization_id = 'd0e4b0e6-f137-42ce-8c63-60dbd7d05851', updated_at = NOW()
WHERE email = 'joey.metz@fidescommunication.com';

-- Fix Matthew Hoog (Fides Communication)
UPDATE users 
SET organization_id = 'd0e4b0e6-f137-42ce-8c63-60dbd7d05851', updated_at = NOW()
WHERE email = 'matthew.hoog@fidescommunication.com';

-- ============================================================================
-- MULTI-MEMBERSHIP USERS (DO NOT UPDATE)
-- ============================================================================
-- These users are intentionally members of multiple orgs:
-- - admin@netneural.ai (7 orgs - super admin)
-- - cnorris@meetchorus.com (2 orgs - Chorus + Proud Hound Coffee)
-- - heath.scheiman@netneural.ai (2 orgs - Volcor + NetNeural)
-- 
-- Decision: Leave organization_id as NetNeural, they can switch contexts in UI

-- ============================================================================
-- NO MEMBERSHIP USERS (DELETE TEST ACCOUNTS)
-- ============================================================================
-- These users have no organization_members entries and are test accounts

-- Delete test accounts
DELETE FROM users WHERE email = 'admin@netneural.com';
DELETE FROM users WHERE email = 'wiley.borg@v-mark.com';
DELETE FROM users WHERE email = 'test@test.com';

-- ============================================================================
-- VERIFICATION: Check after updates
-- ============================================================================
SELECT 
  u.email,
  u.organization_id as user_org_id,
  o1.name as user_org_name,
  om.organization_id as member_org_id,
  o2.name as member_org_name,
  CASE 
    WHEN u.organization_id = om.organization_id THEN '✅ Match'
    WHEN om.organization_id IS NULL THEN '⚠️  No membership'
    ELSE '❌ Mismatch'
  END as status
FROM users u
LEFT JOIN organizations o1 ON u.organization_id = o1.id
LEFT JOIN organization_members om ON u.id = om.user_id
LEFT JOIN organizations o2 ON om.organization_id = o2.id
WHERE u.organization_id != om.organization_id 
   OR (u.organization_id IS NOT NULL AND om.organization_id IS NULL)
ORDER BY u.email;

-- ============================================================================
-- COUNT BY STATUS
-- ============================================================================
SELECT 
  CASE 
    WHEN u.organization_id = om.organization_id THEN 'matched'
    WHEN om.organization_id IS NULL THEN 'no_membership'
    ELSE 'mismatched'
  END as status,
  COUNT(*) as count
FROM users u
LEFT JOIN organization_members om ON u.id = om.user_id
GROUP BY status;
