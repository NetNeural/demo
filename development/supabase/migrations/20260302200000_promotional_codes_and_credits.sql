-- #60: Plan management CRUD and billing administration tools
-- Creates promotional_codes and account_credits tables

-- ── Promotional Codes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promotional_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_percent INTEGER CHECK (discount_percent BETWEEN 1 AND 100),
  discount_amount_cents INTEGER,
  duration_months INTEGER,          -- NULL = forever
  max_redemptions INTEGER,          -- NULL = unlimited
  current_redemptions INTEGER DEFAULT 0,
  organization_id UUID REFERENCES organizations(id),  -- NULL = global
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  stripe_coupon_id VARCHAR(255),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promotional_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promotional_codes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promo_codes_org ON promotional_codes(organization_id) WHERE organization_id IS NOT NULL;

-- RLS
ALTER TABLE promotional_codes ENABLE ROW LEVEL SECURITY;

-- Super admins and org owners can read all promo codes
CREATE POLICY "promo_codes_select" ON promotional_codes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
    OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = promotional_codes.organization_id
        AND om.role = 'owner'
    )
  );

-- Only super admins can insert/update/delete promo codes
CREATE POLICY "promo_codes_insert" ON promotional_codes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "promo_codes_update" ON promotional_codes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "promo_codes_delete" ON promotional_codes
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- ── Account Credits ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  remaining_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  issued_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_account_credits_org ON account_credits(organization_id);
CREATE INDEX IF NOT EXISTS idx_account_credits_remaining ON account_credits(remaining_cents) WHERE remaining_cents > 0;

-- RLS
ALTER TABLE account_credits ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything; org owners can view their own
CREATE POLICY "account_credits_select" ON account_credits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
    OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = account_credits.organization_id
        AND om.role IN ('owner', 'billing')
    )
  );

CREATE POLICY "account_credits_insert" ON account_credits
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "account_credits_update" ON account_credits
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- Grant access to authenticated users (RLS handles filtering)
GRANT SELECT, INSERT, UPDATE ON promotional_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON account_credits TO authenticated;
