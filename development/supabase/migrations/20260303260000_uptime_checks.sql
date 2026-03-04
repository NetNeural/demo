-- =============================================================================
-- Migration: Uptime monitoring checks table
-- SOC 2 A1.1 — Availability monitoring
-- =============================================================================

CREATE TABLE IF NOT EXISTS uptime_checks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service     TEXT        NOT NULL,   -- e.g. 'sentinel', 'demo-stage', 'supabase-prod'
  url         TEXT        NOT NULL,
  status      TEXT        NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
  http_code   INT,
  response_ms INT,
  error_msg   TEXT,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uptime_checks_service ON uptime_checks(service, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_status  ON uptime_checks(status, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_recent  ON uptime_checks(checked_at DESC);

-- Auto-purge checks older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_uptime_checks()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM uptime_checks WHERE checked_at < now() - INTERVAL '30 days';
END;
$$;

-- RLS: super_admins can read; write only via service role
ALTER TABLE uptime_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read uptime checks"
  ON uptime_checks FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

-- Helper view: current status per service (latest check)
CREATE OR REPLACE VIEW uptime_current_status AS
SELECT DISTINCT ON (service)
  service,
  url,
  status,
  http_code,
  response_ms,
  error_msg,
  checked_at
FROM uptime_checks
ORDER BY service, checked_at DESC;

-- Grant read on view to authenticated users with super_admin role is handled via RLS on base table
