-- Update admin@netneural.com to super_admin role
UPDATE users 
SET role = 'super_admin' 
WHERE email = 'admin@netneural.com';

-- Verify the update
SELECT id, email, role, full_name, is_active, created_at 
FROM users 
WHERE email = 'admin@netneural.com';
