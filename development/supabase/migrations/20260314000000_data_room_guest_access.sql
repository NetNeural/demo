-- ============================================================================
-- Data Room Guest Access
-- ============================================================================
-- Adds tables for managing external guest access to the Data Room:
--   1. data_room_guests   — invitation tracking & scoped access
--   2. data_room_access_log — audit trail of document views/downloads
-- ============================================================================

-- ── 1. data_room_guests ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_room_guests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_by      UUID NOT NULL REFERENCES auth.users(id),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'revoked')),
  token           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  membership_id   UUID REFERENCES organization_members(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID REFERENCES auth.users(id),
  UNIQUE(organization_id, email)
);

-- Indexes
CREATE INDEX idx_drg_org       ON data_room_guests(organization_id);
CREATE INDEX idx_drg_email     ON data_room_guests(email);
CREATE INDEX idx_drg_token     ON data_room_guests(token) WHERE status = 'pending';
CREATE INDEX idx_drg_user      ON data_room_guests(user_id) WHERE user_id IS NOT NULL;

-- RLS
ALTER TABLE data_room_guests ENABLE ROW LEVEL SECURITY;

-- Super-admins see all
CREATE POLICY "super_admin_all_drg" ON data_room_guests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  )
  WITH CHECK (true);

-- Org owner/admin can manage guests in their org
CREATE POLICY "org_admin_manage_drg" ON data_room_guests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = data_room_guests.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = data_room_guests.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Guests can see their own record
CREATE POLICY "guest_view_own_drg" ON data_room_guests
  FOR SELECT
  USING (user_id = auth.uid());


-- ── 2. data_room_access_log ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_room_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id        UUID REFERENCES data_room_guests(id) ON DELETE SET NULL,
  document_id     UUID NOT NULL REFERENCES org_documents(id) ON DELETE CASCADE,
  document_name   TEXT NOT NULL DEFAULT '',
  action          TEXT NOT NULL DEFAULT 'download'
                    CHECK (action IN ('view', 'download')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_dral_org   ON data_room_access_log(organization_id, created_at DESC);
CREATE INDEX idx_dral_guest ON data_room_access_log(guest_id, created_at DESC);
CREATE INDEX idx_dral_doc   ON data_room_access_log(document_id);

-- RLS
ALTER TABLE data_room_access_log ENABLE ROW LEVEL SECURITY;

-- Super-admins see all
CREATE POLICY "super_admin_all_dral" ON data_room_access_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  )
  WITH CHECK (true);

-- Org owner/admin can view logs in their org
CREATE POLICY "org_admin_view_dral" ON data_room_access_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = data_room_access_log.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Any authenticated user can INSERT their own log entries
CREATE POLICY "user_insert_own_dral" ON data_room_access_log
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can view their own log entries
CREATE POLICY "user_view_own_dral" ON data_room_access_log
  FOR SELECT
  USING (user_id = auth.uid());
