-- ============================================================================
-- Migration: Fix Organization Membership Gaps & Alert Rules RLS
-- ============================================================================
-- Fixes:
--   1. Backfill organization_members for users with organization_id but no
--      membership row (root cause of bugs #436, #455)
--   2. Update create_user_profile() trigger to also create org membership
--      on signup (fixes bug #456)
--   3. Update alert_rules RLS policies to use is_super_admin() + 
--      organization_members pattern (consistent with other tables)
-- ============================================================================

-- ─── 1. Backfill missing organization_members ────────────────────────────────
-- Find all users who have organization_id set but no organization_members row
INSERT INTO public.organization_members (organization_id, user_id, role, joined_at, created_at, updated_at)
SELECT
  u.organization_id,
  u.id,
  CASE
    WHEN u.role IN ('super_admin', 'platform_admin') THEN 'owner'
    WHEN u.role = 'org_admin' THEN 'admin'
    WHEN u.role = 'org_owner' THEN 'owner'
    ELSE 'member'
  END AS role,
  COALESCE(u.created_at, NOW()),
  NOW(),
  NOW()
FROM public.users u
WHERE u.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = u.id
      AND om.organization_id = u.organization_id
  );


-- ─── 2. Update create_user_profile() trigger ────────────────────────────────
-- Now also creates organization_members row when organization_id is provided
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  _org_id uuid;
  _role user_role;
BEGIN
  -- Try to get organization_id from user metadata
  IF NEW.raw_user_meta_data ->> 'organization_id' IS NOT NULL THEN
    _org_id := (NEW.raw_user_meta_data ->> 'organization_id')::uuid;
  END IF;

  -- Determine user role
  _role := COALESCE(
    (NEW.raw_user_meta_data ->> 'role')::user_role,
    'user'::user_role
  );

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
    _role,
    _org_id,
    true,
    NOW(),
    NOW(),
    COALESCE((NEW.raw_user_meta_data ->> 'password_change_required')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;

  -- Also create organization_members row if org is specified
  IF _org_id IS NOT NULL THEN
    INSERT INTO public.organization_members (
      organization_id,
      user_id,
      role,
      joined_at,
      created_at,
      updated_at
    )
    VALUES (
      _org_id,
      NEW.id,
      CASE
        WHEN _role IN ('super_admin'::user_role, 'platform_admin'::user_role) THEN 'owner'
        WHEN _role = 'org_admin'::user_role THEN 'admin'
        WHEN _role = 'org_owner'::user_role THEN 'owner'
        ELSE 'member'
      END,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN unique_violation THEN
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

    -- Still create org membership with fallback role
    IF _org_id IS NOT NULL THEN
      INSERT INTO public.organization_members (
        organization_id,
        user_id,
        role,
        joined_at,
        created_at,
        updated_at
      )
      VALUES (
        _org_id,
        NEW.id,
        'member',
        NOW(),
        NOW(),
        NOW()
      )
      ON CONFLICT (organization_id, user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public';


-- ─── 3. Update alert_rules RLS policies ─────────────────────────────────────
-- Drop old policies that used users.organization_id (unreliable)
DROP POLICY IF EXISTS "Users can view alert rules in their organization" ON alert_rules;
DROP POLICY IF EXISTS "Admins can create alert rules" ON alert_rules;
DROP POLICY IF EXISTS "Admins can update alert rules" ON alert_rules;
DROP POLICY IF EXISTS "Admins can delete alert rules" ON alert_rules;

-- New SELECT policy: org members + super_admin
CREATE POLICY "Users can view alert rules in their organization" ON alert_rules
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- New INSERT policy: org admin/owner + super_admin
CREATE POLICY "Admins can create alert rules" ON alert_rules
  FOR INSERT WITH CHECK (
    is_super_admin(auth.uid())
    OR organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- New UPDATE policy: org admin/owner + super_admin
CREATE POLICY "Admins can update alert rules" ON alert_rules
  FOR UPDATE USING (
    is_super_admin(auth.uid())
    OR organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- New DELETE policy: org admin/owner + super_admin
CREATE POLICY "Admins can delete alert rules" ON alert_rules
  FOR DELETE USING (
    is_super_admin(auth.uid())
    OR organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );
