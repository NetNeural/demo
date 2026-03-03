-- Feature Permissions Override Table
-- Allows super admins to customise which roles can access which features
-- Code-level defaults remain in getOrganizationPermissions(); rows here OVERRIDE those defaults.
-- SOC 2: only super_admin users may read/write this table (enforced via RLS + DB function).

CREATE TABLE IF NOT EXISTS public.feature_permissions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id     TEXT        NOT NULL,                          -- e.g. 'nav:devices', 'action:canManageMembers'
  feature_type   TEXT        NOT NULL DEFAULT 'nav',            -- 'nav' | 'action'
  role           TEXT        NOT NULL,                          -- 'viewer'|'member'|'admin'|'owner'|'billing'|'super_admin'
  access_level   TEXT        NOT NULL DEFAULT 'enabled',        -- 'enabled'|'disabled'|'netneural_only'|'superadmin_only'
  notes          TEXT,
  updated_by     UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (feature_id, role)
);

-- Trigger: keep updated_at current
CREATE OR REPLACE FUNCTION public.set_feature_permissions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feature_permissions_updated_at ON public.feature_permissions;
CREATE TRIGGER trg_feature_permissions_updated_at
  BEFORE UPDATE ON public.feature_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_feature_permissions_updated_at();

-- RLS
ALTER TABLE public.feature_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_full_access" ON public.feature_permissions;
CREATE POLICY "super_admin_full_access"
  ON public.feature_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND is_super_admin = true
    )
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_feature_permissions_lookup
  ON public.feature_permissions (feature_id, role);

COMMENT ON TABLE public.feature_permissions IS
  'Super-admin managed overrides for feature/nav access per org role. '
  'Rows here take precedence over code-level defaults in getOrganizationPermissions().';
