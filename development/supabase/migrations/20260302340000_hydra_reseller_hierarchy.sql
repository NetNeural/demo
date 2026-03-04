-- ============================================================
-- Migration: Project Hydra – Reseller Hierarchy Data Model
-- Story: #326
-- ============================================================

-- ─── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE reseller_agreement_status AS ENUM (
    'pending', 'active', 'suspended', 'terminated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE support_model AS ENUM ('self', 'hybrid', 'netneural');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Extend organizations table ───────────────────────────────────────────────

-- Reseller identity flags
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_reseller             BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reseller_since          TIMESTAMPTZ  NULL,
  ADD COLUMN IF NOT EXISTS reseller_agreement_status reseller_agreement_status NULL,

-- Support model (for story #336)
  ADD COLUMN IF NOT EXISTS support_model           support_model NOT NULL DEFAULT 'hybrid',
  ADD COLUMN IF NOT EXISTS support_fee_pct         NUMERIC(5,4)  NOT NULL DEFAULT 0.05,

-- Tier lock fields (for story #331)
  ADD COLUMN IF NOT EXISTS tier_locked_until       TIMESTAMPTZ  NULL,
  ADD COLUMN IF NOT EXISTS tier_lock_reason        TEXT         NULL,

-- Reseller-specific slug control (signup attribution story #399)
  ADD COLUMN IF NOT EXISTS reseller_slug_active    BOOLEAN      NOT NULL DEFAULT TRUE;

-- Note: parent_organization_id already exists on this table and serves as parent_reseller_id.
-- We enforce reseller hierarchy through the is_reseller flag + parent_organization_id.

-- Index for tree traversal performance
CREATE INDEX IF NOT EXISTS idx_orgs_parent_organization
  ON organizations (parent_organization_id)
  WHERE parent_organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orgs_is_reseller
  ON organizations (is_reseller)
  WHERE is_reseller = TRUE;

-- ─── Reseller agreements ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reseller_agreements (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  terms_version       TEXT         NOT NULL DEFAULT '1.0',
  commission_rate_pct NUMERIC(5,4) NOT NULL,
  signed_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  signed_by_user_id   UUID         NULL REFERENCES auth.users(id),
  ip_address          TEXT         NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reseller_agreements_org
  ON reseller_agreements (organization_id);

-- ─── Recursive CTE helper function ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_reseller_tree(root_org_id UUID)
RETURNS TABLE (
  id               UUID,
  name             TEXT,
  slug             TEXT,
  parent_id        UUID,
  depth            INT,
  path             UUID[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH RECURSIVE downline AS (
    -- Base: the root reseller
    SELECT
      o.id,
      o.name,
      o.slug,
      o.parent_organization_id AS parent_id,
      0                        AS depth,
      ARRAY[o.id]              AS path
    FROM organizations o
    WHERE o.id = root_org_id

    UNION ALL

    -- Recursive: children
    SELECT
      o.id,
      o.name,
      o.slug,
      o.parent_organization_id AS parent_id,
      d.depth + 1,
      d.path || o.id
    FROM organizations o
    JOIN downline d ON o.parent_organization_id = d.id
    -- Circular reference guard: stop if id already in path
    WHERE NOT (o.id = ANY(d.path))
      AND d.depth < 20  -- hard cap at 20 levels
  )
  SELECT id, name, slug, parent_id, depth, path
  FROM downline;
$$;

-- ─── RLS policies ─────────────────────────────────────────────────────────────

ALTER TABLE reseller_agreements ENABLE ROW LEVEL SECURITY;

-- Reseller org members can read their own agreement
CREATE POLICY "Members read own reseller agreement"
  ON reseller_agreements FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Only super_admin / NetNeural can insert
CREATE POLICY "Super admin manages reseller agreements"
  ON reseller_agreements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role = 'super_admin'
        AND o.slug = 'netneural-demo'
    )
  );
