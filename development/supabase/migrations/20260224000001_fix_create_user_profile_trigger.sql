-- Fix create_user_profile trigger: cast role text to user_role enum
-- Root cause: trigger was inserting role as text but column is user_role enum type
-- This caused "Database error creating new user" on auth.admin.createUser()

CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.users (
    id, email, full_name, role, is_active, created_at, updated_at, password_change_required
  ) VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'user'::user_role),
    true,
    NOW(),
    NOW(),
    COALESCE((NEW.raw_user_meta_data ->> 'password_change_required')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
  WHEN invalid_text_representation THEN
    -- If role value is invalid for the enum, default to 'user'
    INSERT INTO public.users (
      id, email, full_name, role, is_active, created_at, updated_at, password_change_required
    ) VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data ->> 'full_name',
      'user'::user_role,
      true,
      NOW(),
      NOW(),
      COALESCE((NEW.raw_user_meta_data ->> 'password_change_required')::boolean, false)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;
