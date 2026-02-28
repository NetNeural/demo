-- ============================================================================
-- Migration: Create Trigger for Auto-Creating User Profiles
-- ============================================================================
-- Ensures that whenever a user is created in auth.users,
-- a corresponding profile is created in public.users table
--
-- File: 20260223000001_auto_create_user_profiles.sql

-- Create trigger function to auto-create user profile on auth.users creation
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert new user profile into public.users table
  INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at,
    password_change_required
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE((NEW.raw_user_meta_data ->> 'role'), 'user'),
    true,
    NOW(),
    NOW(),
    COALESCE((NEW.raw_user_meta_data ->> 'password_change_required')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_profile();
