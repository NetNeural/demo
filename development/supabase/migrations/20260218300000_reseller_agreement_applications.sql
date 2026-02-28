-- Reseller agreement applications table
-- Tracks when an organization applies for a reseller agreement
-- Applications create GitHub issues for review, and once approved
-- a reseller_agreement row is created.

CREATE TABLE IF NOT EXISTS reseller_agreement_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Applicant info
  applicant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  applicant_name VARCHAR(255) NOT NULL,
  applicant_email VARCHAR(255) NOT NULL,
  applicant_title VARCHAR(255),            -- Job title
  applicant_phone VARCHAR(50),
  -- Company details
  company_legal_name VARCHAR(255) NOT NULL,
  company_address TEXT NOT NULL,
  company_website VARCHAR(500),
  company_tax_id VARCHAR(100),
  -- Business case
  estimated_customers INTEGER NOT NULL DEFAULT 1,
  target_market TEXT,                      -- Description of target market/vertical
  business_model TEXT,                     -- How they plan to resell
  preferred_billing VARCHAR(50) DEFAULT 'per_org',  -- 'per_org', 'per_device', 'flat_rate'
  additional_notes TEXT,
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'submitted',  -- 'submitted', 'under_review', 'approved', 'rejected'
  github_issue_number INTEGER,
  github_issue_url TEXT,
  -- Review info
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reseller_app_org
  ON reseller_agreement_applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_reseller_app_status
  ON reseller_agreement_applications(status);

-- RLS
ALTER TABLE reseller_agreement_applications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Org owners/admins can view their own applications
  DROP POLICY IF EXISTS "Org members can view their applications" ON reseller_agreement_applications;
  CREATE POLICY "Org members can view their applications" ON reseller_agreement_applications
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = reseller_agreement_applications.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin')
      )
    );

  -- Org owners can insert applications
  DROP POLICY IF EXISTS "Org owners can submit applications" ON reseller_agreement_applications;
  CREATE POLICY "Org owners can submit applications" ON reseller_agreement_applications
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = reseller_agreement_applications.organization_id
          AND om.user_id = auth.uid()
          AND om.role = 'owner'
      )
    );

  -- Super admins can do everything
  DROP POLICY IF EXISTS "Super admins manage applications" ON reseller_agreement_applications;
  CREATE POLICY "Super admins manage applications" ON reseller_agreement_applications
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
          AND u.role = 'super_admin'
      )
    );
END $$;

COMMENT ON TABLE reseller_agreement_applications IS 
  'Tracks reseller agreement applications. When approved, a reseller_agreements row is created and the org tier is upgraded.';
