-- Add password change required flag for temporary passwords
-- Date: 2026-02-14

-- Add column to track if user must change password on next login
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_password_change_required 
ON users(password_change_required) 
WHERE password_change_required = TRUE;

-- Add comment
COMMENT ON COLUMN users.password_change_required IS 'True if user has a temporary password and must change it on next login';
