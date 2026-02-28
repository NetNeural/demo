-- ============================================================================
-- Migration: Align starter plan max_users with issue #318 requirements
-- Date: 2026-02-28
-- Purpose: Starter plan seat limit = 3 (was 5)
-- ============================================================================

UPDATE billing_plans
SET max_users = 3, updated_at = now()
WHERE slug = 'starter' AND is_active = true;

-- Verify
DO $$
DECLARE
  v_max INTEGER;
BEGIN
  SELECT max_users INTO v_max FROM billing_plans WHERE slug = 'starter' AND is_active = true;
  IF v_max IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Expected starter max_users = 3, got %', v_max;
  END IF;
  RAISE NOTICE 'Starter plan max_users updated to 3';
END $$;
