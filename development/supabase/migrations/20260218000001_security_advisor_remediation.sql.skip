-- ============================================================================
-- SECURITY ADVISOR REMEDIATION
-- ============================================================================
-- Addresses all findings from Supabase Security Advisor (Issue #43):
--   1. Enable RLS on 5 unprotected tables
--   2. Set search_path on all SECURITY DEFINER functions
--   3. Tighten overly permissive USING(true) RLS policies
-- ============================================================================

-- ============================================================================
-- PART 1: Enable RLS on unprotected tables + add org-scoped policies
-- ============================================================================

-- 1a. device_credentials (linked to devices via device_id, no org_id directly)
ALTER TABLE device_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read credentials for their org devices"
  ON device_credentials FOR SELECT TO authenticated
  USING (
    device_id IN (
      SELECT d.id FROM devices d
      JOIN organization_members om ON om.organization_id = d.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can manage credentials for their org devices"
  ON device_credentials FOR ALL TO authenticated
  USING (
    device_id IN (
      SELECT d.id FROM devices d
      JOIN organization_members om ON om.organization_id = d.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to device_credentials"
  ON device_credentials FOR ALL TO service_role
  USING (true);

-- 1b. device_credential_access_log (linked via credential_id -> device_credentials -> devices)
ALTER TABLE device_credential_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read access logs for their org devices"
  ON device_credential_access_log FOR SELECT TO authenticated
  USING (
    credential_id IN (
      SELECT dc.id FROM device_credentials dc
      JOIN devices d ON d.id = dc.device_id
      JOIN organization_members om ON om.organization_id = d.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to device_credential_access_log"
  ON device_credential_access_log FOR ALL TO service_role
  USING (true);

-- 1c. device_firmware_history (linked to devices via device_id)
ALTER TABLE device_firmware_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read firmware history for their org devices"
  ON device_firmware_history FOR SELECT TO authenticated
  USING (
    device_id IN (
      SELECT d.id FROM devices d
      JOIN organization_members om ON om.organization_id = d.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to device_firmware_history"
  ON device_firmware_history FOR ALL TO service_role
  USING (true);

-- 1d. firmware_artifacts (has organization_id directly)
ALTER TABLE firmware_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read firmware artifacts for their orgs"
  ON firmware_artifacts FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can manage firmware artifacts for their orgs"
  ON firmware_artifacts FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to firmware_artifacts"
  ON firmware_artifacts FOR ALL TO service_role
  USING (true);

-- 1e. sync_conflicts (linked to devices via device_id)
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sync conflicts for their org devices"
  ON sync_conflicts FOR SELECT TO authenticated
  USING (
    device_id IN (
      SELECT d.id FROM devices d
      JOIN organization_members om ON om.organization_id = d.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can manage sync conflicts for their org devices"
  ON sync_conflicts FOR ALL TO authenticated
  USING (
    device_id IN (
      SELECT d.id FROM devices d
      JOIN organization_members om ON om.organization_id = d.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to sync_conflicts"
  ON sync_conflicts FOR ALL TO service_role
  USING (true);

-- ============================================================================
-- PART 2: Set search_path on all SECURITY DEFINER functions
-- ============================================================================
-- This prevents search-path injection attacks on privileged functions.
-- Uses a DO block to dynamically find and fix ALL SECURITY DEFINER functions
-- in the public schema that are missing an explicit search_path setting.
-- This is safer than manually specifying signatures which can drift.
-- ============================================================================

DO $$
DECLARE
  func_record RECORD;
  alter_sql TEXT;
BEGIN
  FOR func_record IN
    SELECT 
      p.oid,
      n.nspname AS schema_name,
      p.proname AS func_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) AS func_args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true  -- SECURITY DEFINER
      AND (
        p.proconfig IS NULL 
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
        )
      )
  LOOP
    -- Special case: get_user_emails needs auth schema access
    IF func_record.func_name = 'get_user_emails' THEN
      alter_sql := format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = public, auth, pg_temp',
        func_record.schema_name,
        func_record.func_name,
        func_record.func_args
      );
    ELSE
      alter_sql := format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = public',
        func_record.schema_name,
        func_record.func_name,
        func_record.func_args
      );
    END IF;
    
    RAISE NOTICE 'Fixing search_path: %', alter_sql;
    EXECUTE alter_sql;
  END LOOP;
END;
$$;

-- ============================================================================
-- PART 3: Tighten overly permissive USING(true) RLS policies
-- ============================================================================
-- Replace USING(true) with org-scoped checks on tables that have organization_id.
-- Tables with org-scoped data: organizations, users, organization_members,
-- device_integrations, locations, departments, devices, device_data, alerts.
-- 
-- Strategy: DROP old policy + CREATE new org-scoped policy.
-- Note: SELECT on users/organizations must allow visibility within shared orgs
-- (needed for user lists, org dropdowns, etc.)
-- ============================================================================

-- Helper comment: The org-scoped subquery pattern used throughout:
--   organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())

-- --- users ---
DROP POLICY IF EXISTS "users_select_authenticated" ON users;
CREATE POLICY "users_select_authenticated"
  ON users FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR id IN (
      SELECT om2.user_id FROM organization_members om1
      JOIN organization_members om2 ON om2.organization_id = om1.organization_id
      WHERE om1.user_id = auth.uid()
    )
  );

-- --- organizations ---
DROP POLICY IF EXISTS "organizations_select_authenticated" ON organizations;
CREATE POLICY "organizations_select_authenticated"
  ON organizations FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "organizations_update_authenticated" ON organizations;
CREATE POLICY "organizations_update_authenticated"
  ON organizations FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- --- organization_members ---
DROP POLICY IF EXISTS "org_members_update_authenticated" ON organization_members;
CREATE POLICY "org_members_update_authenticated"
  ON organization_members FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "org_members_delete_authenticated" ON organization_members;
CREATE POLICY "org_members_delete_authenticated"
  ON organization_members FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- --- device_integrations ---
DROP POLICY IF EXISTS "device_integrations_select_authenticated" ON device_integrations;
CREATE POLICY "device_integrations_select_authenticated"
  ON device_integrations FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "device_integrations_update_authenticated" ON device_integrations;
CREATE POLICY "device_integrations_update_authenticated"
  ON device_integrations FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "device_integrations_delete_authenticated" ON device_integrations;
CREATE POLICY "device_integrations_delete_authenticated"
  ON device_integrations FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- --- locations ---
DROP POLICY IF EXISTS "locations_select_authenticated" ON locations;
CREATE POLICY "locations_select_authenticated"
  ON locations FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "locations_update_authenticated" ON locations;
CREATE POLICY "locations_update_authenticated"
  ON locations FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "locations_delete_authenticated" ON locations;
CREATE POLICY "locations_delete_authenticated"
  ON locations FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- --- departments ---
DROP POLICY IF EXISTS "departments_select_authenticated" ON departments;
CREATE POLICY "departments_select_authenticated"
  ON departments FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "departments_update_authenticated" ON departments;
CREATE POLICY "departments_update_authenticated"
  ON departments FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "departments_delete_authenticated" ON departments;
CREATE POLICY "departments_delete_authenticated"
  ON departments FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- --- devices ---
DROP POLICY IF EXISTS "devices_select_authenticated" ON devices;
CREATE POLICY "devices_select_authenticated"
  ON devices FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "devices_update_authenticated" ON devices;
CREATE POLICY "devices_update_authenticated"
  ON devices FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "devices_delete_authenticated" ON devices;
CREATE POLICY "devices_delete_authenticated"
  ON devices FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- --- device_data ---
DROP POLICY IF EXISTS "device_data_select_authenticated" ON device_data;
CREATE POLICY "device_data_select_authenticated"
  ON device_data FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- --- alerts ---
DROP POLICY IF EXISTS "alerts_select_authenticated" ON alerts;
CREATE POLICY "alerts_select_authenticated"
  ON alerts FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "alerts_update_authenticated" ON alerts;
CREATE POLICY "alerts_update_authenticated"
  ON alerts FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- --- audit_logs (may or may not exist depending on conditional migration) ---
DROP POLICY IF EXISTS "audit_logs_select_authenticated" ON audit_logs;
CREATE POLICY "audit_logs_select_authenticated"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- --- mqtt_messages ---
DROP POLICY IF EXISTS "mqtt_messages_select_authenticated" ON mqtt_messages;
CREATE POLICY "mqtt_messages_select_authenticated"
  ON mqtt_messages FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- --- notification_log ---
DROP POLICY IF EXISTS "notification_log_select_authenticated" ON notification_log;
CREATE POLICY "notification_log_select_authenticated"
  ON notification_log FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- --- integration_activity_log ---
DROP POLICY IF EXISTS "integration_activity_log_select_authenticated" ON integration_activity_log;
CREATE POLICY "integration_activity_log_select_authenticated"
  ON integration_activity_log FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES (run manually to confirm)
-- ============================================================================
-- Check tables with RLS disabled:
--   SELECT schemaname, tablename, rowsecurity 
--   FROM pg_tables 
--   WHERE schemaname = 'public' AND NOT rowsecurity;
--
-- Check SECURITY DEFINER functions without search_path:
--   SELECT n.nspname, p.proname, p.prosecdef, p.proconfig
--   FROM pg_proc p 
--   JOIN pg_namespace n ON p.pronamespace = n.oid
--   WHERE n.nspname = 'public' AND p.prosecdef = true
--   AND (p.proconfig IS NULL OR NOT EXISTS (
--     SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
--   ));
--
-- Check policies with USING(true):
--   SELECT schemaname, tablename, policyname, qual
--   FROM pg_policies
--   WHERE schemaname = 'public' AND qual = 'true';
-- ============================================================================
