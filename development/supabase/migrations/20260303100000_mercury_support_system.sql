-- ============================================================
-- Mercury Support System — Epic #359
-- Tables: admin_support_shifts, support_chat_sessions,
--         support_chat_messages, support_tickets
-- ============================================================

-- Admin duty shifts (clock in / clock out)
CREATE TABLE IF NOT EXISTS admin_support_shifts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clocked_in_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  clocked_out_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_shifts_admin  ON admin_support_shifts(admin_user_id, clocked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_shifts_active ON admin_support_shifts(clocked_out_at) WHERE clocked_out_at IS NULL;

-- Chat sessions (one per user conversation)
CREATE TABLE IF NOT EXISTS support_chat_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id  UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  status           TEXT        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'resolved', 'escalated')),
  assigned_admin_id UUID       REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_sessions_user   ON support_chat_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_sessions_active ON support_chat_sessions(status) WHERE status = 'active';

-- Individual chat messages
CREATE TABLE IF NOT EXISTS support_chat_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES support_chat_sessions(id) ON DELETE CASCADE,
  sender_type  TEXT        NOT NULL CHECK (sender_type IN ('user', 'mercury', 'admin', 'system')),
  sender_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  content      TEXT        NOT NULL,
  metadata     JSONB       DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_session ON support_chat_messages(session_id, created_at ASC);

-- Support tickets (created when no admin on duty or user escalates)
CREATE TABLE IF NOT EXISTS support_tickets (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID        REFERENCES support_chat_sessions(id) ON DELETE SET NULL,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id   UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  subject           TEXT        NOT NULL,
  description       TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority          TEXT        NOT NULL DEFAULT 'normal'
                                CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_admin_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user   ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status) WHERE status IN ('open', 'in_progress');

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_support_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS support_sessions_updated_at ON support_chat_sessions;
CREATE TRIGGER support_sessions_updated_at
  BEFORE UPDATE ON support_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_support_updated_at();

DROP TRIGGER IF EXISTS support_tickets_updated_at ON support_tickets;
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_support_updated_at();

-- RLS
ALTER TABLE admin_support_shifts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets       ENABLE ROW LEVEL SECURITY;

-- Users see their own data; service role (edge functions) bypasses RLS
CREATE POLICY "shifts_own"    ON admin_support_shifts  FOR ALL USING (auth.uid() = admin_user_id);
CREATE POLICY "sessions_own"  ON support_chat_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "messages_via_session" ON support_chat_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM support_chat_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);
CREATE POLICY "tickets_own"   ON support_tickets FOR ALL USING (auth.uid() = user_id);
