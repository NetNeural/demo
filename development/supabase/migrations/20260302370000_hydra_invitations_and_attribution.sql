-- ============================================================
-- Migration: Project Hydra – Reseller Invitations & Attribution
-- Stories: #337, #399
-- ============================================================

-- ─── Reseller invitations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reseller_invitations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_org_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invitee_email    TEXT        NOT NULL,
  token            UUID        NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status           TEXT        NOT NULL DEFAULT 'pending', -- 'pending'|'accepted'|'expired'|'revoked'
  invited_by_user  UUID        NULL REFERENCES auth.users(id),
  accepted_org_id  UUID        NULL REFERENCES organizations(id),
  accepted_by_user UUID        NULL REFERENCES auth.users(id),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at      TIMESTAMPTZ NULL,
  revoked_at       TIMESTAMPTZ NULL,
  CONSTRAINT invitations_valid_status CHECK (
    status IN ('pending', 'accepted', 'expired', 'revoked')
  )
);

CREATE INDEX IF NOT EXISTS idx_invitations_inviter
  ON reseller_invitations (inviter_org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_token
  ON reseller_invitations (token) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invitations_email
  ON reseller_invitations (invitee_email) WHERE status = 'pending';

-- ─── Reseller branding ────────────────────────────────────────────────────────
-- Note: orgs already have branding in settings JSONB.
-- This table provides explicit reseller-branded signup page overrides.

CREATE TABLE IF NOT EXISTS reseller_branding (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID        NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  company_display_name TEXT        NULL,
  tagline              TEXT        NULL,
  logo_url             TEXT        NULL,
  favicon_url          TEXT        NULL,
  primary_color        TEXT        NOT NULL DEFAULT '#0F172A',
  support_email        TEXT        NULL,
  -- Signup page specific
  signup_headline      TEXT        NULL,
  signup_subtitle      TEXT        NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Signup attribution log ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS signup_attribution (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_org_id UUID        NOT NULL REFERENCES organizations(id),
  reseller_slug   TEXT        NOT NULL,
  new_org_id      UUID        NULL REFERENCES organizations(id),
  new_user_id     UUID        NULL REFERENCES auth.users(id),
  invitation_id   UUID        NULL REFERENCES reseller_invitations(id),
  ip_hash         TEXT        NULL,
  user_agent_hash TEXT        NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_attribution_reseller
  ON signup_attribution (reseller_org_id, created_at DESC);

-- ─── Slug redirect history ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reseller_slug_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id),
  old_slug        TEXT        NOT NULL,
  new_slug        TEXT        NOT NULL,
  redirect_until  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE reseller_invitations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_branding     ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_attribution    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_slug_history ENABLE ROW LEVEL SECURITY;

-- Invitations: inviter org members read their own
CREATE POLICY "Members read own invitations"
  ON reseller_invitations FOR SELECT
  USING (
    inviter_org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members manage own invitations"
  ON reseller_invitations FOR INSERT
  WITH CHECK (
    inviter_org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Reseller branding: public read for active resellers (powers signup page)
CREATE POLICY "Public reads reseller branding"
  ON reseller_branding FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE is_reseller = TRUE AND is_active = TRUE
    )
  );

CREATE POLICY "Members manage own branding"
  ON reseller_branding FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Attribution: reseller org members read their own
CREATE POLICY "Members read own attribution"
  ON signup_attribution FOR SELECT
  USING (
    reseller_org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Slug history: members read own
CREATE POLICY "Members read own slug history"
  ON reseller_slug_history FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
