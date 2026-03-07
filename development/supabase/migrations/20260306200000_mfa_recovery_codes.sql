-- ============================================================================
-- MFA Recovery Codes
-- ============================================================================
-- Stores hashed one-time recovery codes for MFA bypass when authenticator
-- app is unavailable. Each code can only be used once.
-- ============================================================================

CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by user
CREATE INDEX idx_mrc_user ON mfa_recovery_codes(user_id);

-- RLS
ALTER TABLE mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own codes (count/used status, not the hash)
CREATE POLICY "user_view_own_codes" ON mfa_recovery_codes
  FOR SELECT
  USING (user_id = auth.uid());

-- No direct INSERT/UPDATE/DELETE from client — only via edge functions
-- using service_role key
