-- Migration: Organization Media Accounts (Secure Social Media Credentials)
-- Date: 2026-03-05
-- Description: Stores encrypted social media API credentials per organization.
--   Credentials are encrypted at rest and only accessible to org admins/owners.

CREATE TABLE IF NOT EXISTS organization_media_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'linkedin', 'instagram', 'facebook', 'threads', 'bluesky', 'mastodon', 'youtube')),
  display_name TEXT NOT NULL DEFAULT '',        -- e.g. "@NetNeural" or page name
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Encrypted credential fields (stored as encrypted text, never returned raw)
  encrypted_api_key TEXT,       -- API key / client ID
  encrypted_api_secret TEXT,    -- API secret / client secret
  encrypted_access_token TEXT,  -- OAuth access token
  encrypted_refresh_token TEXT, -- OAuth refresh token (if applicable)
  token_expires_at TIMESTAMPTZ, -- When the access token expires
  -- Metadata
  scopes TEXT[] DEFAULT '{}',   -- Granted API scopes (e.g. 'tweet.write', 'media.upload')
  account_id TEXT,              -- Platform-side account/user ID
  account_url TEXT,             -- Link to the profile
  last_used_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  connected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, platform)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_media_accounts_org
  ON organization_media_accounts(organization_id);

CREATE INDEX IF NOT EXISTS idx_org_media_accounts_platform
  ON organization_media_accounts(organization_id, platform);

-- Enable RLS
ALTER TABLE organization_media_accounts ENABLE ROW LEVEL SECURITY;

-- RLS: Org members can view (non-secret columns only — encrypted fields are stripped by edge function)
CREATE POLICY "org_media_accounts_select"
  ON organization_media_accounts FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS: Only org admins/owners can insert/update/delete
CREATE POLICY "org_media_accounts_insert"
  ON organization_media_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_media_accounts_update"
  ON organization_media_accounts FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_media_accounts_delete"
  ON organization_media_accounts FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Super admin override
CREATE POLICY "org_media_accounts_superadmin"
  ON organization_media_accounts FOR ALL
  TO authenticated
  USING (
    is_super_admin(auth.uid())
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_media_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_media_accounts_updated_at
  BEFORE UPDATE ON organization_media_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_media_accounts_updated_at();

COMMENT ON TABLE organization_media_accounts IS 'Encrypted social media account credentials per organization';
COMMENT ON COLUMN organization_media_accounts.encrypted_api_key IS 'Encrypted API key / client ID — never returned raw to frontend';
COMMENT ON COLUMN organization_media_accounts.encrypted_api_secret IS 'Encrypted API secret — never returned raw to frontend';
COMMENT ON COLUMN organization_media_accounts.encrypted_access_token IS 'Encrypted OAuth access token';
COMMENT ON COLUMN organization_media_accounts.encrypted_refresh_token IS 'Encrypted OAuth refresh token';
