-- ============================================================================
-- Fix Missing User Profile
-- ============================================================================
-- Error: User exists in auth.users but NOT in public.users table
-- This causes "Cannot coerce the result to a single JSON object (0 rows)"
--
-- Your user ID: db25a233-be46-4cea-a490-6e3a12fd75ce

-- Step 1: Check if your user exists in the users table
SELECT id, email, role, organization_id FROM users 
WHERE id = 'db25a233-be46-4cea-a490-6e3a12fd75ce';

-- If this returns NO ROWS, continue to Step 2

-- ============================================================================
-- Step 2: Get your email from auth.users
-- ============================================================================
-- Run this query to see your authenticated user info:

SELECT 
  id,
  email,
  created_at
FROM auth.users
WHERE id = 'db25a233-be46-4cea-a490-6e3a12fd75ce';

-- This SHOULD return your email. Copy it, you'll need it for Step 3.

-- ============================================================================
-- Step 3: Create the missing user profile
-- ============================================================================
-- Replace 'YOUR_EMAIL@example.com' with your actual email from Step 2

INSERT INTO users (
  id,
  email,
  full_name,
  role,
  organization_id,
  is_active,
  created_at,
  updated_at,
  password_change_required
)
VALUES (
  'db25a233-be46-4cea-a490-6e3a12fd75ce',
  'YOUR_EMAIL@example.com',          -- REPLACE THIS
  'Super Admin',                       -- Your full name
  'super_admin',                       -- Set as super admin
  NULL,                                -- Super admins have no organization
  true,                                -- Active
  now(),
  now(),
  false                                -- No password change required
)
ON CONFLICT (id) DO NOTHING;

-- Verify it was created:
SELECT id, email, role, organization_id FROM users 
WHERE id = 'db25a233-be46-4cea-a490-6e3a12fd75ce';

-- Should now return ONE ROW with your data

-- ============================================================================
-- Step 4: After migration, refresh your browser
-- ============================================================================
-- 1. Hard refresh the page: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
-- 2. Or sign out and sign back in
-- 3. You should now see the dashboard
-- 4. Settings tab on organizations should be visible
-- 5. Delete button should no longer be grayed out
