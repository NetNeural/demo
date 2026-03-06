-- Migration: Sync email changes from auth.users to public.users
-- Date: 2026-03-05
-- Purpose: When a user confirms an email change, auth.users.email updates
--          but public.users.email was left stale. This trigger keeps them in sync.

CREATE OR REPLACE FUNCTION public.handle_auth_email_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when the email actually changed
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.users
    SET email = NEW.email,
        updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users for email changes
DROP TRIGGER IF EXISTS on_auth_email_change ON auth.users;
CREATE TRIGGER on_auth_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_auth_email_change();

COMMENT ON FUNCTION public.handle_auth_email_change() IS
  'Syncs email changes from auth.users to public.users when a user confirms an email update';
