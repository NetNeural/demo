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
  )
ON CONFLICT DO NOTHING;


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


-- ─── 3. Fix broken audit trigger on alert_rules ─────────────────────────────
-- The audit_alert_rule_changes() trigger references non-existent columns:
-- NEW.severity, NEW.is_active, NEW.conditions, NEW.notification_channels
-- The actual columns are: enabled, condition (no severity column exists)
-- Drop the broken trigger so alert rule inserts/updates work
DROP TRIGGER IF EXISTS trigger_audit_alert_rule_changes ON alert_rules;

-- Recreate with correct column names
CREATE OR REPLACE FUNCTION audit_alert_rule_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

    IF TG_OP = 'INSERT' THEN
        PERFORM log_user_action(
            auth.uid(),
            v_user_email,
            NEW.organization_id,
            'alert_management',
            'alert_rule_created',
            'alert_rule',
            NEW.id,
            NEW.name,
            'POST',
            '/api/alert-rules',
            jsonb_build_object('rule', row_to_json(NEW)),
            jsonb_build_object('rule_type', NEW.rule_type, 'enabled', NEW.enabled),
            'success'
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.name IS NOT DISTINCT FROM NEW.name
           AND OLD.enabled IS NOT DISTINCT FROM NEW.enabled
           AND OLD.condition IS NOT DISTINCT FROM NEW.condition
           AND OLD.actions IS NOT DISTINCT FROM NEW.actions THEN
            RETURN NEW;
        END IF;

        PERFORM log_user_action(
            auth.uid(),
            v_user_email,
            NEW.organization_id,
            'alert_management',
            CASE
                WHEN OLD.enabled IS DISTINCT FROM NEW.enabled THEN
                    CASE WHEN NEW.enabled THEN 'alert_rule_enabled' ELSE 'alert_rule_disabled' END
                ELSE 'alert_rule_updated'
            END,
            'alert_rule',
            NEW.id,
            NEW.name,
            'PUT',
            '/api/alert-rules/' || NEW.id,
            jsonb_build_object(
                'before', row_to_json(OLD),
                'after', row_to_json(NEW)
            ),
            jsonb_build_object('rule_type', NEW.rule_type, 'enabled', NEW.enabled),
            'success'
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_user_action(
            auth.uid(),
            v_user_email,
            OLD.organization_id,
            'alert_management',
            'alert_rule_deleted',
            'alert_rule',
            OLD.id,
            OLD.name,
            'DELETE',
            '/api/alert-rules/' || OLD.id,
            jsonb_build_object('rule', row_to_json(OLD)),
            jsonb_build_object('rule_type', OLD.rule_type),
            'success'
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
    -- Don't let audit failures block the actual operation
    RAISE WARNING 'Audit trigger failed: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_audit_alert_rule_changes
    AFTER INSERT OR UPDATE OR DELETE ON alert_rules
    FOR EACH ROW EXECUTE FUNCTION audit_alert_rule_changes();


-- ─── 4. Ensure is_super_admin() helper exists ────────────────────────────────
-- Required by RLS policies below; may already exist from 20260306 migration
-- Use DROP + CREATE to allow parameter rename if needed
DROP FUNCTION IF EXISTS public.is_super_admin(uuid);
CREATE FUNCTION public.is_super_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = check_user_id AND role IN ('super_admin', 'platform_admin')
  );
$$;

-- ─── 4. Update alert_rules RLS policies ─────────────────────────────────────
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
