-- Migration: Fix admin RLS policies for account_credits and promotional_codes
-- Description: Ensures super_admin can INSERT into these tables
--              (idempotent — safe to run multiple times)
-- Related: GitHub issues #418, #419

-- ── Promotional Codes ──────────────────────────────────────────────────────

-- Drop and recreate INSERT/UPDATE/DELETE policies to ensure they're correct
DROP POLICY IF EXISTS "promo_codes_insert" ON promotional_codes;
DROP POLICY IF EXISTS "promo_codes_update" ON promotional_codes;
DROP POLICY IF EXISTS "promo_codes_delete" ON promotional_codes;
DROP POLICY IF EXISTS "promo_codes_select" ON promotional_codes;

CREATE POLICY "promo_codes_select" ON promotional_codes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = promotional_codes.organization_id
        AND om.role = 'owner'
    )
  );

CREATE POLICY "promo_codes_insert" ON promotional_codes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY "promo_codes_update" ON promotional_codes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY "promo_codes_delete" ON promotional_codes
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

-- Ensure correct grants
GRANT SELECT, INSERT, UPDATE, DELETE ON promotional_codes TO authenticated;

-- ── Account Credits ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "account_credits_select" ON account_credits;
DROP POLICY IF EXISTS "account_credits_insert" ON account_credits;
DROP POLICY IF EXISTS "account_credits_update" ON account_credits;
DROP POLICY IF EXISTS "account_credits_delete" ON account_credits;

CREATE POLICY "account_credits_select" ON account_credits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'
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
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY "account_credits_update" ON account_credits
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY "account_credits_delete" ON account_credits
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

-- Ensure correct grants
GRANT SELECT, INSERT, UPDATE, DELETE ON account_credits TO authenticated;
