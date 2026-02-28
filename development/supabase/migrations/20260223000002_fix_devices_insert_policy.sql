-- ============================================================================
-- Fix: Restore devices INSERT RLS policy
--
-- The security_advisor_remediation migration (applied manually) dropped and
-- recreated SELECT/UPDATE/DELETE policies for devices with org-scoped
-- conditions, but omitted the INSERT policy entirely — leaving inserts
-- blocked for all authenticated users (403 Forbidden).
-- ============================================================================

-- Drop in case a stale version exists
DROP POLICY IF EXISTS "devices_insert_authenticated" ON devices;

-- Recreate with proper org-scoped check (matches pattern of other device policies)
CREATE POLICY "devices_insert_authenticated"
  ON devices FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
