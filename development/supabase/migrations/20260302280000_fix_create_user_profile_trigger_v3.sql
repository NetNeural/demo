-- ============================================================================
-- Migration: Fix create_user_profile() trigger v3
-- ============================================================================
-- Root cause of "Database error saving new user" on signup:
--   20260301120000_fix_null_organization_id.sql updated the trigger but:
--   1. Removed the ::user_role enum cast (risk of type mismatch)
--   2. Removed all EXCEPTION handlers — so any unique_violation on email
--      (e.g. orphaned public.users row from a previous attempt) propagated
--      to Supabase auth and surfaced as "Database error saving new user"
--
-- This migration restores:
--   - Explicit ::user_role cast (as in 20260224000001)
--   - EXCEPTION blocks for unique_violation and invalid_text_representation
--   - Keeps the organization_id from metadata improvement (from 20260301120000)

CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  _org_id uuid;
BEGIN
  -- Try to get organization_id from user metadata (set by create-user / organizations edge functions)
  IF NEW.raw_user_meta_data ->> 'organization_id' IS NOT NULL THEN
    _org_id := (NEW.raw_user_meta_data ->> 'organization_id')::uuid;
  END IF;

  -- Insert new user profile into public.users table
  INSERT INTO public.users (
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
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'user'::user_role),
    _org_id,
    true,
    NOW(),
    NOW(),
    COALESCE((NEW.raw_user_meta_data ->> 'password_change_required')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;

EXCEPTION
  WHEN unique_violation THEN
    -- Email already exists in public.users (orphaned row from a previous
    -- partial signup or admin-created user). Auth user was created
    -- successfully — don't block it.
    RETURN NEW;
  WHEN invalid_text_representation THEN
    -- role value in metadata is not a valid user_role enum — default to 'user'
    INSERT INTO public.users (
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
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data ->> 'full_name',
      'user'::user_role,
      _org_id,
      true,
      NOW(),
      NOW(),
      COALESCE((NEW.raw_user_meta_data ->> 'password_change_required')::boolean, false)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public';
