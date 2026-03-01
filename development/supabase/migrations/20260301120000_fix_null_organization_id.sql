-- ============================================================================
-- Migration: Fix NULL organization_id on user profile creation
-- ============================================================================
-- Root cause: The create_user_profile() trigger did not pass organization_id
-- from user metadata, and the members edge function never updates
-- users.organization_id when adding a user to their first org.
--
-- This migration:
-- 1. Updates the trigger to read organization_id from user_metadata if present
-- 2. Backfills any existing users with NULL organization_id from their
--    organization_members records

-- 1. Update the trigger function to include organization_id from metadata
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
    COALESCE((NEW.raw_user_meta_data ->> 'role'), 'user'),
    _org_id,
    true,
    NOW(),
    NOW(),
    COALESCE((NEW.raw_user_meta_data ->> 'password_change_required')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Backfill: set organization_id from organization_members for any user
--    that currently has NULL organization_id
UPDATE public.users u
SET organization_id = om.organization_id,
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (user_id) user_id, organization_id
  FROM public.organization_members
  ORDER BY user_id, joined_at ASC
) om
WHERE u.id = om.user_id
  AND u.organization_id IS NULL;
