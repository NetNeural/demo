-- Grant permissions for password_change_required column
-- This ensures all users can read their own password_change_required flag

-- Grant SELECT permission on the column to authenticated users
GRANT SELECT (password_change_required) ON users TO authenticated;

-- Grant UPDATE permission so users can clear the flag after changing password
GRANT UPDATE (password_change_required) ON users TO authenticated;
