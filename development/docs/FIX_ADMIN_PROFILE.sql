-- ============================================================================
-- Fix User Profile for admin@netneural.ai
-- ============================================================================
-- Error: Duplicate key on email — profile exists but with wrong ID
-- Fix: Update the existing row to match your actual auth.users ID

-- Step 1: Find both IDs to understand the mismatch
SELECT 'auth.users' as source, id, email FROM auth.users WHERE email = 'admin@netneural.ai'
UNION ALL
SELECT 'public.users' as source, id, email FROM public.users WHERE email = 'admin@netneural.ai';

-- Step 2: Create your user profile (if missing)
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
  'admin@netneural.ai',
  'Super Admin',
  'super_admin',
  NULL,
  true,
  now(),
  now(),
  false
)
ON CONFLICT (id) DO UPDATE SET
  email = 'admin@netneural.ai',
  role = 'super_admin',
  is_active = true,
  updated_at = now();

-- Step 3: Verify it worked
SELECT id, email, role, organization_id, is_active 
FROM users 
WHERE email = 'admin@netneural.ai';

-- Should return:
-- id                                   | email               | role       | organization_id | is_active
-- ─────────────────────────────────────┼─────────────────────┼────────────┼─────────────────┼───────────
-- db25a233-be46-4cea-a490-6e3a12fd75ce | admin@netneural.ai  | super_admin| NULL            | true
