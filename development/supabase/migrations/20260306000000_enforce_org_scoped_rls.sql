-- ============================================================================
-- Migration: Enforce Organization-Scoped RLS (Replace USING(true) Policies)
-- ============================================================================
-- Problem: An emergency RLS fix (20251106120000_rls_fix_production_safe.sql)
--          set USING(true) on core tables to fix a recursion bug. This means
--          ANY authenticated user can read/write ALL organizations' data via
--          direct REST API calls, bypassing the Edge Functions that enforce
--          business logic.
--
-- Fix:     Scope every policy to the user's own organization memberships.
--          Avoid recursion by:
--            1. Using a SECURITY DEFINER function for super_admin checks
--               (runs outside RLS context, no circular dependency)
--            2. Querying organization_members directly (its SELECT policy is
--               simply user_id = auth.uid() — cannot recurse)
--
-- Hierarchy: service_role bypasses RLS entirely (Supabase default).
--            All Edge Functions use service_role, so they are unaffected.
-- ============================================================================

-- ── Step 1: SECURITY DEFINER helper — checks super_admin without recursion ──
-- This function runs with the definer's privileges (bypassing RLS on the users
-- table), so it can safely check the role column without triggering policies.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- ── Step 2: public.users ─────────────────────────────────────────────────────
-- Before: Any authenticated user could read ALL user records platform-wide.
-- After:  Users can only see their own record plus records in their org(s).

DROP POLICY IF EXISTS "users_select_authenticated" ON users;
DROP POLICY IF EXISTS "users_insert_authenticated" ON users;

-- SELECT: own record + same-org members + super admin sees all
CREATE POLICY "users_select_scoped"
  ON users FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR public.is_super_admin()
  );

-- INSERT: users can only create their own profile row (registration path);
-- all admin-driven inserts go through Edge Functions using service_role.
CREATE POLICY "users_insert_own_or_admin"
  ON users FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    OR public.is_super_admin()
  );

-- UPDATE stays as-is (id = auth.uid()) — see users_update_own policy.

-- ── Step 3: organizations ────────────────────────────────────────────────────
-- Before: USING(true) — every org was visible to every authenticated user.
-- After:  Only orgs the user is a member of are visible.

DROP POLICY IF EXISTS "organizations_select_authenticated" ON organizations;
DROP POLICY IF EXISTS "organizations_select_all_authenticated" ON organizations;
DROP POLICY IF EXISTS "organizations_update_authenticated" ON organizations;

-- SELECT: own memberships + super admin
CREATE POLICY "organizations_select_scoped"
  ON organizations FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR public.is_super_admin()
  );

-- UPDATE: must be an owner/admin of that org (or super admin);
-- all other updates go through service_role Edge Functions.
CREATE POLICY "organizations_update_scoped"
  ON organizations FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR public.is_super_admin()
  );

-- ── Step 4: organization_members (CRITICAL — writes were fully open) ──────────
-- Before: INSERT/UPDATE/DELETE USING(true) — any user could add themselves
--         or others to ANY org, or modify/delete any membership.
-- After:  Writes via authenticated JWT restricted to super_admin only.
--         Org admins manage members through Edge Functions (service_role).

DROP POLICY IF EXISTS "org_members_insert_authenticated" ON organization_members;
DROP POLICY IF EXISTS "org_members_update_authenticated" ON organization_members;
DROP POLICY IF EXISTS "org_members_delete_authenticated" ON organization_members;

-- INSERT: super_admin only via authenticated JWT
CREATE POLICY "org_members_insert_admin_only"
  ON organization_members FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- UPDATE: super_admin only (role promotions always via Edge Functions)
CREATE POLICY "org_members_update_admin_only"
  ON organization_members FOR UPDATE TO authenticated
  USING (public.is_super_admin());

-- DELETE: super_admin OR user removing themselves from an org
CREATE POLICY "org_members_delete_scoped"
  ON organization_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin()
  );

-- ── Step 5: devices ──────────────────────────────────────────────────────────
-- Before: USING(true) on all four operations.
-- After:  Scoped to user's org membership.

DROP POLICY IF EXISTS "devices_select_authenticated" ON devices;
DROP POLICY IF EXISTS "devices_insert_authenticated" ON devices;
DROP POLICY IF EXISTS "devices_update_authenticated" ON devices;
DROP POLICY IF EXISTS "devices_delete_authenticated" ON devices;

CREATE POLICY "devices_select_scoped"
  ON devices FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR public.is_super_admin()
  );

CREATE POLICY "devices_insert_scoped"
  ON devices FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR public.is_super_admin()
  );

CREATE POLICY "devices_update_scoped"
  ON devices FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR public.is_super_admin()
  );

CREATE POLICY "devices_delete_scoped"
  ON devices FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR public.is_super_admin()
  );

-- ── Step 6: device_data ──────────────────────────────────────────────────────
-- No direct organization_id — must scope through devices table.
-- Before: USING(true). After: scoped via device → org membership.

DROP POLICY IF EXISTS "device_data_select_authenticated" ON device_data;

CREATE POLICY "device_data_select_scoped"
  ON device_data FOR SELECT TO authenticated
  USING (
    device_id IN (
      SELECT d.id FROM devices d
      WHERE d.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
    OR public.is_super_admin()
  );

-- ── Step 7: device_telemetry_history ─────────────────────────────────────────
-- Before: USING(true). After: scoped to own org.

DROP POLICY IF EXISTS "Authenticated users can read telemetry" ON device_telemetry_history;

CREATE POLICY "telemetry_select_scoped"
  ON device_telemetry_history FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR public.is_super_admin()
  );

-- ── Step 8: alerts ───────────────────────────────────────────────────────────
-- Before: SELECT and UPDATE USING(true).
-- After:  Scoped to own org's alerts.

DROP POLICY IF EXISTS "alerts_select_authenticated" ON alerts;
DROP POLICY IF EXISTS "alerts_update_authenticated" ON alerts;

CREATE POLICY "alerts_select_scoped"
  ON alerts FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR public.is_super_admin()
  );

CREATE POLICY "alerts_update_scoped"
  ON alerts FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR public.is_super_admin()
  );

-- ── Step 9: device_integrations ──────────────────────────────────────────────
-- Contains Golioth/MQTT API credentials — highly sensitive.
-- Before: Full CRUD USING(true). After: read = own org, writes = owner/admin.

DROP POLICY IF EXISTS "device_integrations_select_authenticated" ON device_integrations;
DROP POLICY IF EXISTS "device_integrations_insert_authenticated" ON device_integrations;
DROP POLICY IF EXISTS "device_integrations_update_authenticated" ON device_integrations;
DROP POLICY IF EXISTS "device_integrations_delete_authenticated" ON device_integrations;

CREATE POLICY "device_integrations_select_scoped"
  ON device_integrations FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR public.is_super_admin()
  );

CREATE POLICY "device_integrations_write_scoped"
  ON device_integrations FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR public.is_super_admin()
  );

-- ── Step 10: locations ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "locations_select_authenticated" ON locations;
DROP POLICY IF EXISTS "locations_insert_authenticated" ON locations;
DROP POLICY IF EXISTS "locations_update_authenticated" ON locations;
DROP POLICY IF EXISTS "locations_delete_authenticated" ON locations;

CREATE POLICY "locations_select_scoped"
  ON locations FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR public.is_super_admin()
  );

CREATE POLICY "locations_write_scoped"
  ON locations FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR public.is_super_admin()
  );

-- ── Step 11: departments (no org column — scoped via locations) ───────────────
DROP POLICY IF EXISTS "departments_select_authenticated" ON departments;
DROP POLICY IF EXISTS "departments_insert_authenticated" ON departments;
DROP POLICY IF EXISTS "departments_update_authenticated" ON departments;
DROP POLICY IF EXISTS "departments_delete_authenticated" ON departments;

CREATE POLICY "departments_select_scoped"
  ON departments FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT l.id FROM locations l
      WHERE l.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
    OR public.is_super_admin()
  );

CREATE POLICY "departments_write_scoped"
  ON departments FOR ALL TO authenticated
  USING (
    location_id IN (
      SELECT l.id FROM locations l
      WHERE l.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin')
      )
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    location_id IN (
      SELECT l.id FROM locations l
      WHERE l.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin')
      )
    )
    OR public.is_super_admin()
  );

-- ── Step 12: audit_logs ──────────────────────────────────────────────────────
-- Before: USING(true) — full audit trail visible to every user.
-- After:  Own actions + org admin sees own org's logs + super admin sees all.

DROP POLICY IF EXISTS "audit_logs_select_authenticated" ON audit_logs;

CREATE POLICY "audit_logs_select_scoped"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR public.is_super_admin()
  );

-- ── Step 13: reseller_settings (global singleton — NetNeural only) ────────────
-- Before: Any authenticated user could read reseller floor pricing and margins.
-- After:  Super admin only.

DROP POLICY IF EXISTS "Authenticated read reseller_settings" ON reseller_settings;
DROP POLICY IF EXISTS "Super admin manages reseller_settings" ON reseller_settings;

CREATE POLICY "reseller_settings_admin_only"
  ON reseller_settings FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ── Step 14: reseller_tiers (pricing/margin config — NetNeural only) ──────────
-- Before: Any authenticated user could read tier thresholds and revenue splits.
-- After:  Super admin only.

DROP POLICY IF EXISTS "Authenticated users read tiers" ON reseller_tiers;
DROP POLICY IF EXISTS "Super admin manages tiers" ON reseller_tiers;

CREATE POLICY "reseller_tiers_admin_only"
  ON reseller_tiers FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ── Step 15: report_schedules / report_runs (NetNeural internal) ──────────────
-- Before: Any authenticated user could read/modify NetNeural's report schedules.
-- After:  Super admin only.

DROP POLICY IF EXISTS "Authenticated users can read report_schedules" ON report_schedules;
DROP POLICY IF EXISTS "Authenticated users can update report_schedules" ON report_schedules;
DROP POLICY IF EXISTS "Authenticated users can insert report_schedules" ON report_schedules;
DROP POLICY IF EXISTS "Authenticated users can read report_runs" ON report_runs;
DROP POLICY IF EXISTS "Authenticated users can insert report_runs" ON report_runs;
DROP POLICY IF EXISTS "Authenticated users can update report_runs" ON report_runs;

CREATE POLICY "report_schedules_admin_only"
  ON report_schedules FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "report_runs_admin_only"
  ON report_runs FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ── Step 16: ai_insights_cache ────────────────────────────────────────────────
-- Before: USING(EXISTS(device_id match)) — a data-integrity check, not an
--         access control check. Any user could see any org's AI analysis.
-- After:  Scoped through devices → org membership.

DROP POLICY IF EXISTS "ai_insights_cache_select_authenticated" ON ai_insights_cache;

CREATE POLICY "ai_insights_cache_select_scoped"
  ON ai_insights_cache FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR public.is_super_admin()
  );

-- ── Step 17: Conditional tables (may not exist on all environments) ───────────
-- mqtt_messages, notification_log, integration_activity_log

DO $$
BEGIN
  -- mqtt_messages
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'mqtt_messages') THEN
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS "mqtt_messages_select_authenticated" ON mqtt_messages';
    EXCEPTION WHEN OTHERS THEN NULL; END;

    IF EXISTS (SELECT FROM information_schema.columns
               WHERE table_name = 'mqtt_messages' AND column_name = 'organization_id') THEN
      EXECUTE $q$
        CREATE POLICY "mqtt_messages_select_scoped" ON mqtt_messages
          FOR SELECT TO authenticated
          USING (
            organization_id IN (
              SELECT om.organization_id FROM organization_members om
              WHERE om.user_id = auth.uid()
            )
            OR public.is_super_admin()
          )
      $q$;
    ELSE
      -- No org column: restrict to super_admin until column is confirmed
      EXECUTE $q$
        CREATE POLICY "mqtt_messages_select_admin_only" ON mqtt_messages
          FOR SELECT TO authenticated
          USING (public.is_super_admin())
      $q$;
    END IF;
  END IF;

  -- notification_log
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_log') THEN
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS "notification_log_select_authenticated" ON notification_log';
    EXCEPTION WHEN OTHERS THEN NULL; END;

    IF EXISTS (SELECT FROM information_schema.columns
               WHERE table_name = 'notification_log' AND column_name = 'organization_id') THEN
      EXECUTE $q$
        CREATE POLICY "notification_log_select_scoped" ON notification_log
          FOR SELECT TO authenticated
          USING (
            organization_id IN (
              SELECT om.organization_id FROM organization_members om
              WHERE om.user_id = auth.uid()
            )
            OR public.is_super_admin()
          )
      $q$;
    ELSE
      EXECUTE $q$
        CREATE POLICY "notification_log_select_scoped" ON notification_log
          FOR SELECT TO authenticated
          USING (public.is_super_admin())
      $q$;
    END IF;
  END IF;

  -- integration_activity_log
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'integration_activity_log') THEN
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS "integration_activity_log_select_authenticated" ON integration_activity_log';
    EXCEPTION WHEN OTHERS THEN NULL; END;

    IF EXISTS (SELECT FROM information_schema.columns
               WHERE table_name = 'integration_activity_log' AND column_name = 'organization_id') THEN
      EXECUTE $q$
        CREATE POLICY "integration_activity_log_select_scoped" ON integration_activity_log
          FOR SELECT TO authenticated
          USING (
            organization_id IN (
              SELECT om.organization_id FROM organization_members om
              WHERE om.user_id = auth.uid()
            )
            OR public.is_super_admin()
          )
      $q$;
    ELSE
      EXECUTE $q$
        CREATE POLICY "integration_activity_log_select_scoped" ON integration_activity_log
          FOR SELECT TO authenticated
          USING (public.is_super_admin())
      $q$;
    END IF;
  END IF;
END $$;

-- ── Reload PostgREST schema cache ────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Summary of changes
-- ============================================================================
-- TABLE                       | WAS             | NOW
-- ----------------------------+-----------------+-------------------------------
-- users                       | SELECT true     | own + same org + super_admin
-- users                       | INSERT true     | own id + super_admin
-- organizations               | SELECT true     | member orgs + super_admin
-- organizations               | UPDATE true     | owner/admin role + super_admin
-- organization_members        | INSERT true     | super_admin only
-- organization_members        | UPDATE true     | super_admin only
-- organization_members        | DELETE true     | self + super_admin
-- devices                     | CRUD true       | own org + super_admin
-- device_data                 | SELECT true     | via device→org + super_admin
-- device_telemetry_history    | SELECT true     | own org + super_admin
-- alerts                      | SELECT/UPD true | own org + super_admin
-- device_integrations         | CRUD true       | own org (owner/admin writes)
-- locations                   | CRUD true       | own org (owner/admin writes)
-- departments                 | CRUD true       | via location→org
-- audit_logs                  | SELECT true     | own actions + admin + super
-- reseller_settings           | SELECT authed   | super_admin only
-- reseller_tiers              | SELECT authed   | super_admin only
-- report_schedules/runs       | CRUD authed     | super_admin only
-- ai_insights_cache           | SELECT (broken) | own org + super_admin
-- mqtt_messages               | SELECT true     | own org (or admin if no col)
-- notification_log            | SELECT true     | own org (or admin if no col)
-- integration_activity_log    | SELECT true     | own org (or admin if no col)
-- ============================================================================
