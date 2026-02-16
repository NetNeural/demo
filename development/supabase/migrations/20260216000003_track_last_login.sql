-- Migration: Track user last login timestamp
-- Date: 2026-02-16
-- Purpose: Update users.last_login whenever a user authenticates

-- Create function to update last_login
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_login in users table when auth.users is updated
  -- This happens on every successful authentication
  UPDATE public.users
  SET last_login = NEW.last_sign_in_at
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.handle_user_login();

-- Backfill existing users with their last_sign_in_at from auth.users
UPDATE public.users u
SET last_login = au.last_sign_in_at
FROM auth.users au
WHERE u.id = au.id
  AND au.last_sign_in_at IS NOT NULL
  AND u.last_login IS NULL;

-- Comment for documentation
COMMENT ON FUNCTION public.handle_user_login() IS 
  'Automatically updates users.last_login from auth.users.last_sign_in_at on authentication';
