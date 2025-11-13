-- Migration to make admin@netneural.com a super_admin
-- Run this manually in Supabase SQL Editor: https://supabase.com/dashboard/project/bldojxpockljyivldxwf/sql

-- Step 1: Check if user exists
SELECT id, email, role, full_name 
FROM users 
WHERE email = 'admin@netneural.com';

-- Step 2: Update to super_admin role
UPDATE users 
SET role = 'super_admin' 
WHERE email = 'admin@netneural.com';

-- Step 3: Verify the update
SELECT id, email, role, full_name, is_active, created_at 
FROM users 
WHERE email = 'admin@netneural.com';
