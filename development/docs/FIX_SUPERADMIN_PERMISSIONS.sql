-- ============================================================================
-- Verify and Fix Super Admin Permissions
-- ============================================================================
-- As a super_admin, you should have permission to delete ANY organization
-- including all child organizations of NetNeural

-- Step 1: Check your current user role
SELECT 
  id,
  email,
  role,
  organization_id,
  created_at
FROM users
WHERE id = auth.uid();

-- Expected output:
-- id                | email | role       | organization_id
-- ────────────────────────────────────────────────────────
-- (your uuid)       | ...   | super_admin| NULL or NetNeural org id

-- If role is NOT 'super_admin', that's the problem!

-- ============================================================================
-- Step 2: If role is wrong, fix it
-- ============================================================================
-- Update your user role to super_admin:

UPDATE users
SET role = 'super_admin'
WHERE id = auth.uid();

-- Verify the update worked:
SELECT id, email, role FROM users WHERE id = auth.uid();

-- ============================================================================
-- Step 3: Check NetNeural organization structure
-- ============================================================================
-- See the hierarchy (parent-child relationships):

SELECT 
  id,
  name,
  parent_organization_id,
  created_at,
  is_active
FROM organizations
ORDER BY parent_organization_id, created_at;

-- This will show:
-- - NetNeural (parent_organization_id = NULL)
-- - test2, test3, etc. (parent_organization_id = NetNeural's id)

-- ============================================================================
-- Step 4: After fixing your role to super_admin
-- ============================================================================
-- 1. Log out and log back in (to refresh the JWT token)
-- 2. Go back to test2 organization
-- 3. Click Settings tab (should now be visible)
-- 4. Scroll to Danger Zone
-- 5. Type "test2" and click Delete Organization

-- The delete should now work because:
-- ✅ You are authenticated as super_admin
-- ✅ Super_admins can delete ANY organization per Edge Function logic
-- ✅ No role restrictions on the delete button in frontend
