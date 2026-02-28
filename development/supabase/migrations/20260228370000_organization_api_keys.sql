-- Migration: Organization API Keys table for Enterprise API access gating (#321)
-- Creates table for managing org-scoped API keys with rate limiting

-- API Keys table
CREATE TABLE IF NOT EXISTS public.organization_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                          -- Human-readable key name (e.g. "Production API Key")
  key_prefix TEXT NOT NULL,                    -- First 8 chars of the key for display (e.g. "nn_live_a1b2")
  key_hash TEXT NOT NULL,                      -- SHA-256 hash of the full API key
  scopes TEXT[] NOT NULL DEFAULT '{read}',     -- Permissions: read, write, admin
  rate_limit_per_minute INT NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,                      -- NULL = no expiry
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ                       -- NULL = not revoked
);

-- Indexes
CREATE INDEX idx_org_api_keys_org ON public.organization_api_keys(organization_id);
CREATE INDEX idx_org_api_keys_hash ON public.organization_api_keys(key_hash);
CREATE INDEX idx_org_api_keys_active ON public.organization_api_keys(organization_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.organization_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies: org admins/owners can manage keys
CREATE POLICY "Org admins can view API keys"
  ON public.organization_api_keys
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_api_keys.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );

CREATE POLICY "Org admins can insert API keys"
  ON public.organization_api_keys
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_api_keys.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );

CREATE POLICY "Org admins can update API keys"
  ON public.organization_api_keys
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_api_keys.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );

-- SSO configuration table for Enterprise orgs
CREATE TABLE IF NOT EXISTS public.organization_sso_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'saml',       -- 'saml' | 'oidc'
  entity_id TEXT,                              -- SAML Entity ID / Issuer
  sso_url TEXT,                                -- SAML SSO Login URL
  certificate TEXT,                            -- IdP X.509 Certificate (PEM)
  metadata_url TEXT,                           -- IdP Metadata URL (optional)
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  enforce_sso BOOLEAN NOT NULL DEFAULT false,  -- If true, password login disabled for org
  domain_hint TEXT,                            -- e.g. "acme.com" for auto-redirect
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_sso_config ENABLE ROW LEVEL SECURITY;

-- RLS policies: org owners only for SSO config
CREATE POLICY "Org owners can view SSO config"
  ON public.organization_sso_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_sso_config.organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
        AND om.status = 'active'
    )
  );

CREATE POLICY "Org owners can manage SSO config"
  ON public.organization_sso_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_sso_config.organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
        AND om.status = 'active'
    )
  );

-- Update rate limits for tiers in billing_plans
-- Professional: 60 req/min, Enterprise: unlimited (-1)
COMMENT ON TABLE public.organization_api_keys IS 'API keys scoped to organizations. Enterprise tier only. Rate limits enforced server-side.';
COMMENT ON TABLE public.organization_sso_config IS 'SSO/SAML configuration per organization. Enterprise tier only.';
