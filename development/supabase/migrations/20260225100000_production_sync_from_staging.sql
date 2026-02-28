-- ============================================================================
-- PRODUCTION SYNC MIGRATION
-- ============================================================================
-- Purpose:  Bring production database in sync with staging
-- Date:     2026-02-25
-- Safety:   Uses IF NOT EXISTS / IF NOT EXISTS guards throughout
-- Order:    Types → Tables → Columns → Indexes → RLS → Views → Triggers → Backfill → Storage
--
-- Source migrations consolidated:
--   20260218000003  feedback_table
--   20260218000005  feedback_github_resolution
--   20260218200000  reseller_org_hierarchy
--   20260218300000  reseller_agreement_applications
--   20260219000001  device_types
--   20260219000002  devices_device_type_fk
--   20260220000001  add_test_device_support
--   20260220000002  auto_create_device_types (seed function + trigger)
--   20260220100000  add_user_phone_numbers
--   20260222         service_restart_requests
--   20260223000001  add_location_text_to_devices
--   20260223000003  test_device_telemetry_history
--   20260223000007  add_inactive_account_lifecycle_fields
--   20260224000003  alert_number_and_resolution_notification
--   20260224000004  alert_escalation_timeline_snooze
--   20260217000000  fix_storage_organization_assets
--   20260217200000  notification_settings_and_phone_numbers (sensor_thresholds)
-- ============================================================================

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 1 — ENUM TYPES                                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_type') THEN
    CREATE TYPE feedback_type AS ENUM ('bug_report', 'feature_request');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_status') THEN
    CREATE TYPE feedback_status AS ENUM ('submitted', 'acknowledged', 'in_progress', 'resolved', 'closed');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_severity') THEN
    CREATE TYPE feedback_severity AS ENUM ('critical', 'high', 'medium', 'low');
  END IF;
END $$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 2 — NEW TABLES                                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ─────────────────────────────────────────────────────────────────────────────
-- 2A. device_types  (must precede devices.device_type_id FK)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS device_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Required fields
    name VARCHAR(100) NOT NULL,
    lower_normal DECIMAL(15, 6) NOT NULL,
    upper_normal DECIMAL(15, 6) NOT NULL,

    -- Strongly recommended
    unit VARCHAR(20) DEFAULT '',

    -- Optional fields
    description TEXT,
    device_class VARCHAR(50),
    lower_alert DECIMAL(15, 6),
    upper_alert DECIMAL(15, 6),
    precision_digits SMALLINT DEFAULT 2,
    icon VARCHAR(50),

    -- Metadata
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Constraints
    CONSTRAINT device_types_unique_name_per_org UNIQUE (organization_id, name),
    CONSTRAINT device_types_normal_range_valid CHECK (lower_normal < upper_normal),
    CONSTRAINT device_types_lower_alert_valid CHECK (lower_alert IS NULL OR lower_alert <= lower_normal),
    CONSTRAINT device_types_upper_alert_valid CHECK (upper_alert IS NULL OR upper_alert >= upper_normal),
    CONSTRAINT device_types_precision_range CHECK (precision_digits >= 0 AND precision_digits <= 6)
);

CREATE INDEX IF NOT EXISTS idx_device_types_org ON device_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_device_types_name ON device_types(name);
CREATE INDEX IF NOT EXISTS idx_device_types_class ON device_types(device_class) WHERE device_class IS NOT NULL;

ALTER TABLE device_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_types_select_org_members" ON device_types;
CREATE POLICY "device_types_select_org_members"
    ON device_types FOR SELECT
    USING (
        organization_id IN (
            SELECT om.organization_id
            FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'super_admin'
        )
    );

DROP POLICY IF EXISTS "device_types_insert_admins" ON device_types;
CREATE POLICY "device_types_insert_admins"
    ON device_types FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id
            FROM organization_members om
            WHERE om.user_id = auth.uid()
            AND om.role IN ('admin', 'owner')
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'super_admin'
        )
    );

DROP POLICY IF EXISTS "device_types_update_admins" ON device_types;
CREATE POLICY "device_types_update_admins"
    ON device_types FOR UPDATE
    USING (
        organization_id IN (
            SELECT om.organization_id
            FROM organization_members om
            WHERE om.user_id = auth.uid()
            AND om.role IN ('admin', 'owner')
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'super_admin'
        )
    );

DROP POLICY IF EXISTS "device_types_delete_admins" ON device_types;
CREATE POLICY "device_types_delete_admins"
    ON device_types FOR DELETE
    USING (
        organization_id IN (
            SELECT om.organization_id
            FROM organization_members om
            WHERE om.user_id = auth.uid()
            AND om.role IN ('admin', 'owner')
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'super_admin'
        )
    );

CREATE OR REPLACE FUNCTION update_device_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS device_types_updated_at ON device_types;
CREATE TRIGGER device_types_updated_at
    BEFORE UPDATE ON device_types
    FOR EACH ROW
    EXECUTE FUNCTION update_device_types_updated_at();

COMMENT ON TABLE device_types IS 'Centralized device type configuration with normal ranges, alert thresholds, and measurement metadata';
COMMENT ON COLUMN device_types.lower_normal IS 'Lower bound of normal operating range (inclusive)';
COMMENT ON COLUMN device_types.upper_normal IS 'Upper bound of normal operating range (inclusive)';
COMMENT ON COLUMN device_types.lower_alert IS 'Critical low threshold — must be <= lower_normal';
COMMENT ON COLUMN device_types.upper_alert IS 'Critical high threshold — must be >= upper_normal';
COMMENT ON COLUMN device_types.unit IS 'Unit of measurement (°C, %, lux, ppm, etc.)';
COMMENT ON COLUMN device_types.device_class IS 'Measurement category (temperature, humidity, pressure, etc.)';
COMMENT ON COLUMN device_types.precision_digits IS 'Number of decimal places for display/validation';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2B. feedback
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Feedback content
    type feedback_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    severity feedback_severity,

    -- GitHub integration
    github_issue_number INTEGER,
    github_issue_url TEXT,
    github_resolution TEXT,

    -- Status tracking
    status feedback_status NOT NULL DEFAULT 'submitted',

    -- Submitter context
    browser_info TEXT,
    page_url TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_org ON feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(organization_id, created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_select_org_members" ON feedback;
CREATE POLICY "feedback_select_org_members"
  ON feedback FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "feedback_insert_org_members" ON feedback;
CREATE POLICY "feedback_insert_org_members"
  ON feedback FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "feedback_update_own" ON feedback;
CREATE POLICY "feedback_update_own"
  ON feedback FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

GRANT ALL ON feedback TO service_role;
GRANT SELECT, INSERT ON feedback TO authenticated;

CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feedback_updated_at ON feedback;
CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();

COMMENT ON COLUMN feedback.github_resolution IS 'Resolution notes synced from GitHub when the linked issue is closed';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2C. reseller_agreements
-- ─────────────────────────────────────────────────────────────────────────────

-- Pre-requisite columns on organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS parent_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_parent
  ON organizations(parent_organization_id)
  WHERE parent_organization_id IS NOT NULL;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS reseller_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agreement_type VARCHAR(50) NOT NULL DEFAULT 'standard',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  max_child_organizations INTEGER DEFAULT 10,
  revenue_share_percent NUMERIC(5,2) DEFAULT 0,
  billing_model VARCHAR(50) DEFAULT 'per_org',
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMP WITH TIME ZONE,
  agreement_version VARCHAR(20) DEFAULT '1.0',
  notes TEXT,
  custom_terms JSONB DEFAULT '{}',
  effective_date DATE,
  expiration_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reseller_agreements_org
  ON reseller_agreements(organization_id);

ALTER TABLE reseller_agreements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Reseller owners can view child orgs" ON organizations;
  CREATE POLICY "Reseller owners can view child orgs" ON organizations
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = organizations.parent_organization_id
          AND om.user_id = auth.uid()
          AND om.role = 'owner'
      )
    );
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Org owners can view their reseller agreement" ON reseller_agreements;
  CREATE POLICY "Org owners can view their reseller agreement" ON reseller_agreements
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = reseller_agreements.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin')
      )
    );

  DROP POLICY IF EXISTS "Super admins manage reseller agreements" ON reseller_agreements;
  CREATE POLICY "Super admins manage reseller agreements" ON reseller_agreements
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role = 'super_admin'
      )
    );
END $$;

COMMENT ON COLUMN organizations.parent_organization_id IS
  'References parent org for reseller hierarchy. NULL = top-level org.';
COMMENT ON COLUMN organizations.created_by IS
  'The user who created this organization (for reseller audit trail).';
COMMENT ON TABLE reseller_agreements IS
  'Tracks reseller contracts between NetNeural and reseller-tier organizations.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2D. reseller_agreement_applications
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reseller_agreement_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  applicant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  applicant_name VARCHAR(255) NOT NULL,
  applicant_email VARCHAR(255) NOT NULL,
  applicant_title VARCHAR(255),
  applicant_phone VARCHAR(50),
  company_legal_name VARCHAR(255) NOT NULL,
  company_address TEXT NOT NULL,
  company_website VARCHAR(500),
  company_tax_id VARCHAR(100),
  estimated_customers INTEGER NOT NULL DEFAULT 1,
  target_market TEXT,
  business_model TEXT,
  preferred_billing VARCHAR(50) DEFAULT 'per_org',
  additional_notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'submitted',
  github_issue_number INTEGER,
  github_issue_url TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reseller_app_org
  ON reseller_agreement_applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_reseller_app_status
  ON reseller_agreement_applications(status);

ALTER TABLE reseller_agreement_applications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Org members can view their applications" ON reseller_agreement_applications;
  CREATE POLICY "Org members can view their applications" ON reseller_agreement_applications
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = reseller_agreement_applications.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin')
      )
    );

  DROP POLICY IF EXISTS "Org owners can submit applications" ON reseller_agreement_applications;
  CREATE POLICY "Org owners can submit applications" ON reseller_agreement_applications
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = reseller_agreement_applications.organization_id
          AND om.user_id = auth.uid()
          AND om.role = 'owner'
      )
    );

  DROP POLICY IF EXISTS "Super admins manage applications" ON reseller_agreement_applications;
  CREATE POLICY "Super admins manage applications" ON reseller_agreement_applications
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role = 'super_admin'
      )
    );
END $$;

COMMENT ON TABLE reseller_agreement_applications IS
  'Tracks reseller agreement applications. When approved, a reseller_agreements row is created and the org tier is upgraded.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2E. service_restart_requests
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_restart_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_by UUID REFERENCES auth.users(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    result JSONB,
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_restart_pending
    ON public.service_restart_requests(service_name, status, requested_at)
    WHERE status = 'pending';

ALTER TABLE public.service_restart_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can request service restarts" ON public.service_restart_requests;
CREATE POLICY "Users can request service restarts"
    ON public.service_restart_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their requests" ON public.service_restart_requests;
CREATE POLICY "Users can view their requests"
    ON public.service_restart_requests
    FOR SELECT
    TO authenticated
    USING (requested_by = auth.uid() OR auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "Service role can update requests" ON public.service_restart_requests;
CREATE POLICY "Service role can update requests"
    ON public.service_restart_requests
    FOR UPDATE
    TO service_role
    USING (true);

GRANT SELECT, INSERT ON public.service_restart_requests TO authenticated;
GRANT ALL ON public.service_restart_requests TO service_role;

CREATE OR REPLACE FUNCTION request_service_restart(
    p_service_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request_id UUID;
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.service_restart_requests
        WHERE service_name = p_service_name
        AND status = 'pending'
        AND requested_at > now() - interval '5 minutes'
    ) THEN
        RAISE EXCEPTION 'A restart request is already pending for this service';
    END IF;

    INSERT INTO public.service_restart_requests (
        service_name,
        requested_by,
        status
    ) VALUES (
        p_service_name,
        auth.uid(),
        'pending'
    ) RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION request_service_restart(TEXT) TO authenticated;

COMMENT ON TABLE public.service_restart_requests IS
  'Service restart requests that can be polled by services when direct SSH/API access is unavailable';
COMMENT ON FUNCTION request_service_restart IS
  'Creates a service restart request that will be picked up by the service monitor';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2F. alert_events (timeline)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'notified', 'viewed', 'acknowledged', 'resolved',
    'snoozed', 'unsnoozed', 'escalated', 'comment'
  )),
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_events_alert_id ON alert_events(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_created_at ON alert_events(created_at DESC);

ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_alert_events" ON alert_events;
CREATE POLICY "service_role_alert_events" ON alert_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "users_view_alert_events" ON alert_events;
CREATE POLICY "users_view_alert_events" ON alert_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM alerts a
    JOIN organization_members om ON om.organization_id = a.organization_id
    WHERE a.id = alert_events.alert_id AND om.user_id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2G. alert_escalation_rules
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alert_escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  escalation_delay_minutes INTEGER NOT NULL DEFAULT 30,
  escalate_to_user_ids UUID[] DEFAULT '{}',
  escalate_to_emails TEXT[] DEFAULT '{}',
  notification_channels TEXT[] DEFAULT ARRAY['email'],
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, severity)
);

CREATE INDEX IF NOT EXISTS idx_escalation_rules_org ON alert_escalation_rules(organization_id);

ALTER TABLE alert_escalation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_escalation_rules" ON alert_escalation_rules;
CREATE POLICY "service_role_escalation_rules" ON alert_escalation_rules FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "users_view_escalation_rules" ON alert_escalation_rules;
CREATE POLICY "users_view_escalation_rules" ON alert_escalation_rules FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = alert_escalation_rules.organization_id
    AND om.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "admins_manage_escalation_rules" ON alert_escalation_rules;
CREATE POLICY "admins_manage_escalation_rules" ON alert_escalation_rules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = alert_escalation_rules.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2H-pre. devices table columns (needed by test_device_telemetry_history RLS)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS device_type_id UUID REFERENCES device_types(id) ON DELETE SET NULL;

ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS is_test_device BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS location TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2H. test_device_telemetry_history
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS test_device_telemetry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  telemetry JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_telemetry_device_received
  ON test_device_telemetry_history(device_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_telemetry_org_received
  ON test_device_telemetry_history(organization_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_telemetry_jsonb
  ON test_device_telemetry_history USING GIN (telemetry);

ALTER TABLE test_device_telemetry_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read test telemetry" ON test_device_telemetry_history;
CREATE POLICY "Authenticated users can read test telemetry"
  ON test_device_telemetry_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM devices d
      WHERE d.id = test_device_telemetry_history.device_id
        AND d.organization_id = test_device_telemetry_history.organization_id
        AND d.is_test_device = true
    )
    AND (
      EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = test_device_telemetry_history.organization_id
      )
      OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role = 'super_admin'
      )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert test telemetry" ON test_device_telemetry_history;
CREATE POLICY "Authenticated users can insert test telemetry"
  ON test_device_telemetry_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM devices d
      WHERE d.id = test_device_telemetry_history.device_id
        AND d.organization_id = test_device_telemetry_history.organization_id
        AND d.is_test_device = true
    )
    AND (
      EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = test_device_telemetry_history.organization_id
      )
      OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role = 'super_admin'
      )
    )
  );

GRANT SELECT, INSERT ON test_device_telemetry_history TO authenticated;
GRANT ALL ON test_device_telemetry_history TO service_role;

COMMENT ON TABLE test_device_telemetry_history IS
  'Telemetry written by interactive test controls for test devices only.';


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 3 — ADD COLUMNS TO EXISTING TABLES                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ─────────────────────────────────────────────────────────────────────────────
-- 3A. alerts table — alert_number, snoozed_until, snoozed_by
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_number INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS snoozed_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_alerts_org_number ON alerts(organization_id, alert_number);
CREATE INDEX IF NOT EXISTS idx_alerts_snoozed ON alerts(snoozed_until)
  WHERE snoozed_until IS NOT NULL AND is_resolved = false;

COMMENT ON COLUMN alerts.alert_number IS 'Human-readable sequential alert number per organization (e.g., ALT-42)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3B. devices table — indexes and comments (columns added in 2H-pre above)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_devices_device_type_id ON devices(device_type_id)
    WHERE device_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devices_org_device_type_id ON devices(organization_id, device_type_id)
    WHERE device_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devices_is_test ON devices(is_test_device)
    WHERE is_test_device = true;
CREATE INDEX IF NOT EXISTS idx_devices_org_is_test ON devices(organization_id, is_test_device);

COMMENT ON COLUMN devices.device_type_id IS 'FK to device_types table for inherited configuration (normal ranges, thresholds, units).';
COMMENT ON COLUMN devices.is_test_device IS 'Flag indicating this is a test/fake device for development and testing purposes.';
COMMENT ON COLUMN devices.location IS 'Free-text location description (e.g. "Building A, Floor 2"). Separate from location_id FK.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3C. users table — phone numbers and inactive lifecycle
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone_number_secondary VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone_sms_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_secondary_sms_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS inactive_reminder_last_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_phone_number
    ON users (phone_number)
    WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone_secondary
    ON users (phone_number_secondary)
    WHERE phone_number_secondary IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_sms_enabled
    ON users (phone_sms_enabled)
    WHERE phone_sms_enabled = true AND phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_inactive_lifecycle_candidates
    ON public.users (created_at, inactive_reminder_last_sent_at)
    WHERE is_active = true AND (last_login IS NULL OR password_change_required = true);

COMMENT ON COLUMN users.phone_number IS
    'Primary phone number (E.164 format preferred, e.g. +15551234567)';
COMMENT ON COLUMN users.phone_number_secondary IS
    'Secondary phone number (E.164 format preferred, e.g. +15551234567)';
COMMENT ON COLUMN users.phone_sms_enabled IS
    'Whether user has opted in to receive SMS messages on primary phone number';
COMMENT ON COLUMN users.phone_secondary_sms_enabled IS
    'Whether user has opted in to receive SMS messages on secondary phone number';
COMMENT ON COLUMN public.users.inactive_reminder_last_sent_at IS
    'Last time an inactivity reminder email was sent for accounts that have not logged in/activated.';

-- Phone validation trigger
CREATE OR REPLACE FUNCTION validate_phone_format()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.phone_number IS NOT NULL THEN
        IF NOT regexp_replace(NEW.phone_number, '[\s\-\(\)]', '', 'g') ~ '^\+?[1-9]\d{1,14}$' THEN
            RAISE EXCEPTION 'Invalid phone number format. Use E.164 format (e.g., +15551234567) or local format.';
        END IF;
    END IF;

    IF NEW.phone_number_secondary IS NOT NULL THEN
        IF NOT regexp_replace(NEW.phone_number_secondary, '[\s\-\(\)]', '', 'g') ~ '^\+?[1-9]\d{1,14}$' THEN
            RAISE EXCEPTION 'Invalid secondary phone number format. Use E.164 format (e.g., +15551234567) or local format.';
        END IF;
    END IF;

    IF NEW.phone_number IS NULL THEN
        NEW.phone_sms_enabled := false;
    END IF;

    IF NEW.phone_number_secondary IS NULL THEN
        NEW.phone_secondary_sms_enabled := false;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_phone_numbers ON users;
CREATE TRIGGER validate_phone_numbers
    BEFORE INSERT OR UPDATE OF phone_number, phone_number_secondary, phone_sms_enabled, phone_secondary_sms_enabled
    ON users
    FOR EACH ROW
    EXECUTE FUNCTION validate_phone_format();

GRANT SELECT, UPDATE ON users TO authenticated;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 4 — VIEWS                                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ─────────────────────────────────────────────────────────────────────────────
-- 4A. alert_statistics
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW alert_statistics AS
SELECT
  a.organization_id,
  COUNT(*) AS total_alerts,
  COUNT(*) FILTER (WHERE NOT a.is_resolved) AS active_alerts,
  COUNT(*) FILTER (WHERE a.is_resolved) AS resolved_alerts,
  COUNT(*) FILTER (WHERE a.severity = 'critical' AND NOT a.is_resolved) AS active_critical,
  COUNT(*) FILTER (WHERE a.severity = 'high' AND NOT a.is_resolved) AS active_high,
  COUNT(*) FILTER (WHERE a.snoozed_until IS NOT NULL AND a.snoozed_until > now() AND NOT a.is_resolved) AS snoozed_alerts,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (a.resolved_at - a.created_at)) / 60.0
  ) FILTER (WHERE a.is_resolved AND a.resolved_at IS NOT NULL AND a.created_at > now() - interval '30 days'), 1)
    AS mttr_minutes,
  ROUND(MIN(
    EXTRACT(EPOCH FROM (a.resolved_at - a.created_at)) / 60.0
  ) FILTER (WHERE a.is_resolved AND a.resolved_at IS NOT NULL AND a.created_at > now() - interval '30 days'), 1)
    AS fastest_resolution_minutes,
  COUNT(*) FILTER (WHERE a.created_at > now() - interval '24 hours') AS alerts_last_24h,
  COUNT(*) FILTER (WHERE a.created_at > now() - interval '7 days') AS alerts_last_7d
FROM alerts a
GROUP BY a.organization_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4B. alert_device_rankings
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW alert_device_rankings AS
SELECT
  a.organization_id,
  a.device_id,
  d.name AS device_name,
  COUNT(*) AS alert_count,
  COUNT(*) FILTER (WHERE NOT a.is_resolved) AS active_count,
  COUNT(*) FILTER (WHERE a.severity = 'critical') AS critical_count,
  MAX(a.created_at) AS last_alert_at
FROM alerts a
LEFT JOIN devices d ON d.id = a.device_id
WHERE a.created_at > now() - interval '30 days'
GROUP BY a.organization_id, a.device_id, d.name
ORDER BY alert_count DESC;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 5 — FUNCTIONS & TRIGGERS                                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ─────────────────────────────────────────────────────────────────────────────
-- 5A. Auto-assign alert_number on INSERT
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION assign_alert_number()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(alert_number), 0) + 1
  INTO NEW.alert_number
  FROM alerts
  WHERE organization_id = NEW.organization_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_alert_number ON alerts;
CREATE TRIGGER trg_assign_alert_number
  BEFORE INSERT ON alerts
  FOR EACH ROW
  WHEN (NEW.alert_number IS NULL)
  EXECUTE FUNCTION assign_alert_number();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5B. Alert timeline event triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- Record 'created' event on new alert
CREATE OR REPLACE FUNCTION record_alert_created_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO alert_events (alert_id, event_type, metadata)
  VALUES (NEW.id, 'created', jsonb_build_object(
    'severity', NEW.severity,
    'category', COALESCE(NEW.category, 'system'),
    'device_id', NEW.device_id,
    'title', NEW.title
  ));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_alert_created_event ON alerts;
CREATE TRIGGER trg_alert_created_event
  AFTER INSERT ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION record_alert_created_event();

-- Record 'resolved' event when alert is resolved
CREATE OR REPLACE FUNCTION record_alert_resolved_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_resolved IS TRUE AND (OLD.is_resolved IS FALSE OR OLD.is_resolved IS NULL) THEN
    INSERT INTO alert_events (alert_id, event_type, user_id, metadata)
    VALUES (NEW.id, 'resolved', NEW.resolved_by, jsonb_build_object(
      'resolved_at', NEW.resolved_at
    ));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_alert_resolved_event ON alerts;
CREATE TRIGGER trg_alert_resolved_event
  AFTER UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION record_alert_resolved_event();

-- Record 'snoozed'/'unsnoozed' events
CREATE OR REPLACE FUNCTION record_alert_snoozed_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.snoozed_until IS NOT NULL AND (OLD.snoozed_until IS NULL OR NEW.snoozed_until <> OLD.snoozed_until) THEN
    INSERT INTO alert_events (alert_id, event_type, user_id, metadata)
    VALUES (NEW.id, 'snoozed', NEW.snoozed_by, jsonb_build_object(
      'snoozed_until', NEW.snoozed_until
    ));
  END IF;
  IF NEW.snoozed_until IS NULL AND OLD.snoozed_until IS NOT NULL THEN
    INSERT INTO alert_events (alert_id, event_type, user_id, metadata)
    VALUES (NEW.id, 'unsnoozed', NEW.snoozed_by, '{}');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_alert_snoozed_event ON alerts;
CREATE TRIGGER trg_alert_snoozed_event
  AFTER UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION record_alert_snoozed_event();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5C. Auto-seed device types for new organizations
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_organization_device_types(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO device_types (organization_id, name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits) VALUES
    (org_id, 'Indoor Temperature (°C)', 'Standard indoor environment monitoring per ASHRAE 55', 'temperature', '°C', 18.0, 26.0, 10.0, 35.0, 1),
    (org_id, 'Indoor Temperature (°F)', 'Standard indoor environment monitoring (imperial)', 'temperature', '°F', 64.0, 79.0, 50.0, 95.0, 1),
    (org_id, 'Cold Storage Temperature', 'Food safety cold chain monitoring (FDA guidelines)', 'temperature', '°C', 0.0, 4.0, -5.0, 10.0, 1),
    (org_id, 'Freezer Temperature', 'Deep freeze monitoring for food/pharma safety', 'temperature', '°C', -25.0, -15.0, -35.0, -10.0, 1),
    (org_id, 'Server Room Temperature', 'Data center thermal management (ASHRAE TC 9.9)', 'temperature', '°C', 18.0, 27.0, 15.0, 32.0, 1),
    (org_id, 'Industrial Process Temperature', 'High-temperature industrial monitoring', 'temperature', '°C', 20.0, 80.0, 0.0, 120.0, 1),
    (org_id, 'Indoor Humidity', 'Comfort range per ASHRAE 55 (30-60% RH)', 'humidity', '% RH', 30.0, 60.0, 20.0, 80.0, 1),
    (org_id, 'Data Center Humidity', 'Server room humidity control (ASHRAE TC 9.9)', 'humidity', '% RH', 40.0, 60.0, 20.0, 80.0, 1),
    (org_id, 'Cold Storage Humidity', 'Refrigerated environment moisture monitoring', 'humidity', '% RH', 75.0, 95.0, 60.0, 100.0, 1),
    (org_id, 'Manufacturing Humidity', 'Industrial process humidity control', 'humidity', '% RH', 30.0, 70.0, 10.0, 90.0, 1),
    (org_id, 'Atmospheric Pressure', 'Barometric pressure for weather monitoring', 'pressure', 'hPa', 980.0, 1030.0, 950.0, 1050.0, 1),
    (org_id, 'Cleanroom Differential Pressure', 'ISO 14644 cleanroom compliance', 'pressure', 'Pa', 5.0, 20.0, 0.0, 30.0, 1),
    (org_id, 'HVAC System Pressure', 'Building management system monitoring', 'pressure', 'Pa', -50.0, 50.0, -100.0, 100.0, 1),
    (org_id, 'CO₂ Concentration', 'Indoor air quality per ASHRAE 62.1', 'air_quality', 'ppm', 400.0, 1000.0, 350.0, 2000.0, 0),
    (org_id, 'CO Concentration', 'Carbon monoxide safety (OSHA PEL: 50ppm)', 'air_quality', 'ppm', 0.0, 9.0, 0.0, 50.0, 1),
    (org_id, 'PM2.5 Particulate', 'Fine particulate matter (WHO guideline)', 'air_quality', 'µg/m³', 0.0, 15.0, 0.0, 35.0, 1),
    (org_id, 'PM10 Particulate', 'Coarse particulate matter (WHO guideline)', 'air_quality', 'µg/m³', 0.0, 45.0, 0.0, 150.0, 1),
    (org_id, 'VOC (Volatile Organic Compounds)', 'Total VOC indoor air quality', 'air_quality', 'ppb', 0.0, 500.0, 0.0, 2000.0, 0),
    (org_id, 'Ozone (O₃)', 'Ground-level ozone (EPA guideline)', 'air_quality', 'ppb', 0.0, 70.0, 0.0, 150.0, 0),
    (org_id, 'Formaldehyde (HCHO)', 'Indoor air toxin monitoring', 'air_quality', 'ppb', 0.0, 30.0, 0.0, 100.0, 1),
    (org_id, 'Radon', 'Radioactive gas monitoring (EPA: <4pCi/L)', 'air_quality', 'pCi/L', 0.0, 4.0, 0.0, 10.0, 1),
    (org_id, 'Indoor Illuminance', 'Office lighting per IES standards (300-500 lux)', 'illuminance', 'lux', 300.0, 500.0, 100.0, 1000.0, 0),
    (org_id, 'Outdoor Illuminance', 'Daylight monitoring for smart controls', 'illuminance', 'lux', 10000.0, 100000.0, 0.0, 120000.0, 0),
    (org_id, 'AC Voltage (120V)', 'Standard US outlet monitoring', 'voltage', 'V', 110.0, 125.0, 100.0, 130.0, 1),
    (org_id, 'AC Voltage (230V)', 'Standard EU/international outlet', 'voltage', 'V', 220.0, 240.0, 200.0, 250.0, 1),
    (org_id, 'DC Voltage (12V)', 'Low-voltage DC systems', 'voltage', 'V', 11.0, 13.0, 10.0, 15.0, 2),
    (org_id, 'Current Draw', 'Electrical current monitoring', 'current', 'A', 0.0, 15.0, 0.0, 20.0, 2),
    (org_id, 'Power Consumption', 'Active power usage', 'power', 'W', 0.0, 1500.0, 0.0, 3000.0, 1),
    (org_id, 'Battery Level', 'Device battery state of charge', 'other', '%', 20.0, 100.0, 10.0, 100.0, 0),
    (org_id, 'Occupancy (Binary)', 'PIR motion/people detection', 'other', 'boolean', 0.0, 1.0, 0.0, 1.0, 0),
    (org_id, 'People Count', 'IR/camera-based occupancy counting', 'other', 'count', 0.0, 50.0, 0.0, 100.0, 0),
    (org_id, 'Water Flow Rate', 'Plumbing/irrigation flow monitoring', 'flow', 'L/min', 0.5, 20.0, 0.0, 50.0, 1),
    (org_id, 'Water Leak Detection', 'Binary leak alarm', 'other', 'boolean', 0.0, 1.0, 0.0, 1.0, 0),
    (org_id, 'Liquid Level', 'Tank/reservoir level monitoring', 'level', '%', 10.0, 90.0, 0.0, 100.0, 1),
    (org_id, 'Sound Level (dBA)', 'Noise pollution monitoring (OSHA: <85dBA)', 'other', 'dBA', 30.0, 85.0, 0.0, 120.0, 1),
    (org_id, 'Vibration (RMS)', 'Industrial equipment condition monitoring', 'other', 'mm/s', 0.0, 10.0, 0.0, 50.0, 2),
    (org_id, 'Ultrasonic Distance', 'Proximity/level measurement', 'distance', 'cm', 5.0, 400.0, 0.0, 500.0, 1),
    (org_id, 'Time-of-Flight Distance', 'Precision laser ranging', 'distance', 'mm', 30.0, 4000.0, 0.0, 5000.0, 0),
    (org_id, 'Soil Moisture', 'Agriculture/landscaping monitoring', 'other', '% VWC', 20.0, 60.0, 10.0, 80.0, 1),
    (org_id, 'Wind Speed', 'Weather station anemometer', 'speed', 'm/s', 0.0, 20.0, 0.0, 50.0, 1),
    (org_id, 'Smoke Detection', 'Fire safety alarm (UL 217/268)', 'other', 'boolean', 0.0, 1.0, 0.0, 1.0, 0),
    (org_id, 'Natural Gas (Methane)', 'Combustible gas safety (LEL%)', 'air_quality', '% LEL', 0.0, 10.0, 0.0, 25.0, 1)
  ON CONFLICT (organization_id, name) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_seed_organization_device_types()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM seed_organization_device_types(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_seed_device_types_on_org_creation ON organizations;
CREATE TRIGGER auto_seed_device_types_on_org_creation
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_organization_device_types();


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 6 — BACKFILL DATA                                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ─────────────────────────────────────────────────────────────────────────────
-- 6A. Backfill alert_number for existing alerts
-- ─────────────────────────────────────────────────────────────────────────────

WITH numbered AS (
  SELECT id, organization_id,
    ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at) AS rn
  FROM alerts
  WHERE alert_number IS NULL
)
UPDATE alerts
SET alert_number = numbered.rn
FROM numbered
WHERE alerts.id = numbered.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6B. Default escalation rules for existing orgs
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO alert_escalation_rules (organization_id, severity, escalation_delay_minutes, enabled)
SELECT id, 'critical', 15, true FROM organizations
ON CONFLICT (organization_id, severity) DO NOTHING;

INSERT INTO alert_escalation_rules (organization_id, severity, escalation_delay_minutes, enabled)
SELECT id, 'high', 30, true FROM organizations
ON CONFLICT (organization_id, severity) DO NOTHING;

INSERT INTO alert_escalation_rules (organization_id, severity, escalation_delay_minutes, enabled)
SELECT id, 'medium', 60, false FROM organizations
ON CONFLICT (organization_id, severity) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6C. Backfill timeline events for existing alerts
-- ─────────────────────────────────────────────────────────────────────────────

-- 'created' events
INSERT INTO alert_events (alert_id, event_type, metadata, created_at)
SELECT
  id,
  'created',
  jsonb_build_object('severity', severity, 'category', COALESCE(category, 'system'), 'device_id', device_id, 'title', title, 'backfilled', true),
  created_at
FROM alerts
WHERE NOT EXISTS (
  SELECT 1 FROM alert_events ae WHERE ae.alert_id = alerts.id AND ae.event_type = 'created'
);

-- 'resolved' events
INSERT INTO alert_events (alert_id, event_type, user_id, metadata, created_at)
SELECT
  id,
  'resolved',
  resolved_by,
  jsonb_build_object('resolved_at', resolved_at, 'backfilled', true),
  COALESCE(resolved_at, created_at + interval '1 second')
FROM alerts
WHERE is_resolved = true
AND NOT EXISTS (
  SELECT 1 FROM alert_events ae WHERE ae.alert_id = alerts.id AND ae.event_type = 'resolved'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6D. Seed device types for existing organizations that lack them
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN
    SELECT o.id FROM organizations o
    WHERE NOT EXISTS (SELECT 1 FROM device_types dt WHERE dt.organization_id = o.id)
  LOOP
    PERFORM seed_organization_device_types(org.id);
  END LOOP;
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 7 — STORAGE BUCKET & POLICIES                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Create / update organization-assets bucket
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'organization-assets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'organization-assets',
      'organization-assets',
      true,
      524288, -- 512KB
      ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
    );
  ELSE
    UPDATE storage.buckets
    SET
      public = true,
      file_size_limit = 524288,
      allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
    WHERE id = 'organization-assets';
  END IF;
END $$;

-- Re-create storage policies (idempotent via DROP IF EXISTS)
DROP POLICY IF EXISTS "Anyone can view organization assets" ON storage.objects;
CREATE POLICY "Anyone can view organization assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'organization-assets');

DROP POLICY IF EXISTS "Organization owners can upload assets" ON storage.objects;
CREATE POLICY "Organization owners can upload assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'organization-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT o.id
    FROM organizations o
    INNER JOIN organization_members om ON o.id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
  )
);

DROP POLICY IF EXISTS "Organization owners can update assets" ON storage.objects;
CREATE POLICY "Organization owners can update assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'organization-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT o.id
    FROM organizations o
    INNER JOIN organization_members om ON o.id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
  )
);

DROP POLICY IF EXISTS "Organization owners can delete assets" ON storage.objects;
CREATE POLICY "Organization owners can delete assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'organization-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT o.id
    FROM organizations o
    INNER JOIN organization_members om ON o.id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
  )
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICATION                                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  _tbl TEXT;
  _col TEXT;
  _missing TEXT := '';
BEGIN
  -- Check tables exist
  FOR _tbl IN SELECT unnest(ARRAY[
    'device_types', 'feedback', 'reseller_agreements',
    'reseller_agreement_applications', 'service_restart_requests',
    'alert_events', 'alert_escalation_rules', 'test_device_telemetry_history'
  ]) LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = _tbl) THEN
      _missing := _missing || 'TABLE ' || _tbl || '; ';
    END IF;
  END LOOP;

  -- Check columns on alerts
  FOR _col IN SELECT unnest(ARRAY['alert_number', 'snoozed_until', 'snoozed_by']) LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'alerts' AND column_name = _col) THEN
      _missing := _missing || 'alerts.' || _col || '; ';
    END IF;
  END LOOP;

  -- Check columns on devices
  FOR _col IN SELECT unnest(ARRAY['device_type_id', 'is_test_device', 'location']) LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = _col) THEN
      _missing := _missing || 'devices.' || _col || '; ';
    END IF;
  END LOOP;

  -- Check columns on users
  FOR _col IN SELECT unnest(ARRAY['phone_number', 'phone_number_secondary', 'phone_sms_enabled', 'phone_secondary_sms_enabled', 'inactive_reminder_last_sent_at']) LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = _col) THEN
      _missing := _missing || 'users.' || _col || '; ';
    END IF;
  END LOOP;

  -- Check enum types
  FOR _tbl IN SELECT unnest(ARRAY['feedback_type', 'feedback_severity', 'feedback_status']) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = _tbl) THEN
      _missing := _missing || 'TYPE ' || _tbl || '; ';
    END IF;
  END LOOP;

  -- Check views
  FOR _tbl IN SELECT unnest(ARRAY['alert_statistics', 'alert_device_rankings']) LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = _tbl) THEN
      _missing := _missing || 'VIEW ' || _tbl || '; ';
    END IF;
  END LOOP;

  -- Check storage bucket
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'organization-assets') THEN
    _missing := _missing || 'BUCKET organization-assets; ';
  END IF;

  IF _missing = '' THEN
    RAISE NOTICE '✅ Production sync migration completed successfully — all objects verified.';
  ELSE
    RAISE EXCEPTION '❌ Migration incomplete. Missing: %', _missing;
  END IF;
END $$;

COMMIT;
