-- Add reseller support: parent_organization_id for org hierarchy
-- and expand subscription_tier to include 'reseller' tier

-- 1. Add parent_organization_id column (self-referencing FK)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS parent_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- 2. Add index for efficient child org lookups
CREATE INDEX IF NOT EXISTS idx_organizations_parent
  ON organizations(parent_organization_id)
  WHERE parent_organization_id IS NOT NULL;

-- 3. Add created_by column to track which user created the org (for reseller audit)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Reseller agreements table — tracks the contract between NetNeural and a reseller org
CREATE TABLE IF NOT EXISTS reseller_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Agreement metadata
  agreement_type VARCHAR(50) NOT NULL DEFAULT 'standard',  -- 'standard', 'premium', 'custom'
  status VARCHAR(50) NOT NULL DEFAULT 'pending',           -- 'pending', 'active', 'suspended', 'terminated'
  -- Terms
  max_child_organizations INTEGER DEFAULT 10,              -- Max child orgs they can create
  revenue_share_percent NUMERIC(5,2) DEFAULT 0,            -- Revenue share percentage
  billing_model VARCHAR(50) DEFAULT 'per_org',             -- 'per_org', 'per_device', 'flat_rate'
  -- Acceptance
  accepted_by UUID REFERENCES auth.users(id),              -- User who accepted the agreement
  accepted_at TIMESTAMP WITH TIME ZONE,                    -- When agreement was accepted
  agreement_version VARCHAR(20) DEFAULT '1.0',             -- Version of the agreement terms
  -- Notes/custom terms (super_admin can set)
  notes TEXT,
  custom_terms JSONB DEFAULT '{}',
  -- Dates
  effective_date DATE,
  expiration_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index on org for quick lookup
CREATE INDEX IF NOT EXISTS idx_reseller_agreements_org
  ON reseller_agreements(organization_id);

-- 5. RLS policy: reseller org owners can see their child organizations
DO $$
BEGIN
  -- Drop if exists to make migration idempotent
  DROP POLICY IF EXISTS "Reseller owners can view child orgs" ON organizations;
  
  CREATE POLICY "Reseller owners can view child orgs" ON organizations
    FOR SELECT USING (
      -- Allow if the user is a member of the parent org with 'owner' role
      EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = organizations.parent_organization_id
          AND om.user_id = auth.uid()
          AND om.role = 'owner'
      )
    );
END $$;

-- 6. RLS for reseller_agreements
ALTER TABLE reseller_agreements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Org owners can view their reseller agreement" ON reseller_agreements;
  CREATE POLICY "Org owners can view their reseller agreement" ON reseller_agreements
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = reseller_agreements.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin')
      )
    );
    
  DROP POLICY IF EXISTS "Super admins manage reseller agreements" ON reseller_agreements;
  CREATE POLICY "Super admins manage reseller agreements" ON reseller_agreements
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role = 'super_admin'
      )
    );
END $$;

-- 7. Comments for documentation
COMMENT ON COLUMN organizations.parent_organization_id IS 
  'References parent org for reseller hierarchy. NULL = top-level org. Reseller-tier orgs can create child orgs.';
COMMENT ON COLUMN organizations.created_by IS 
  'The user who created this organization (for reseller audit trail).';
COMMENT ON TABLE reseller_agreements IS 
  'Tracks reseller contracts between NetNeural and reseller-tier organizations. Defines limits, billing model, and agreement acceptance.';
