-- =============================================================================
-- Migration: Login anomaly detection tables
-- SOC 2 CC7.2 — Monitor and detect failed authentication attempts
-- =============================================================================

-- login_attempts: log every auth attempt (success or failure)
CREATE TABLE IF NOT EXISTS login_attempts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email    TEXT        NOT NULL,
  ip_address    TEXT,
  user_agent    TEXT,
  success       BOOLEAN     NOT NULL DEFAULT false,
  failure_reason TEXT,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email    ON login_attempts(user_email, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip       ON login_attempts(ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_failures ON login_attempts(user_email, success, attempted_at DESC)
  WHERE success = false;

-- account_lockouts: record when an account is locked due to multiple failures
CREATE TABLE IF NOT EXISTS account_lockouts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email    TEXT        NOT NULL,
  locked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until  TIMESTAMPTZ NOT NULL,
  reason        TEXT        NOT NULL DEFAULT 'too_many_failures',
  attempt_count INT         NOT NULL DEFAULT 0,
  unlocked_at   TIMESTAMPTZ,
  unlocked_by   UUID        REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_account_lockouts_email  ON account_lockouts(user_email, locked_until DESC);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_active ON account_lockouts(user_email, locked_until)
  WHERE unlocked_at IS NULL;

-- RLS: only super_admins can read; edge function uses service role to write
ALTER TABLE login_attempts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_lockouts  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read login attempts"
  ON login_attempts FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

CREATE POLICY "Super admins can read account lockouts"
  ON account_lockouts FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

CREATE POLICY "Super admins can update account lockouts"
  ON account_lockouts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

-- Helper: check if an account is currently locked
CREATE OR REPLACE FUNCTION is_account_locked(p_email TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM account_lockouts
    WHERE user_email = p_email
      AND locked_until > now()
      AND unlocked_at IS NULL
  );
$$;

-- Helper: count recent failures for an email
CREATE OR REPLACE FUNCTION count_recent_failures(p_email TEXT, p_minutes INT DEFAULT 10)
RETURNS INT LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::INT
  FROM login_attempts
  WHERE user_email = p_email
    AND success = false
    AND attempted_at > now() - (p_minutes || ' minutes')::INTERVAL;
$$;
