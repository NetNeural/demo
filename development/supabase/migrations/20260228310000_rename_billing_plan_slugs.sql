-- ============================================================================
-- Migration: Rename billing_plan slugs to align with tier_features
-- Date: 2026-02-28
-- Purpose: Unify plan slug naming across billing_plans and tier_features tables
--
-- Old slugs:  monitor  → starter
--             protect  → professional
--             command  → enterprise
--
-- Display names remain: Monitor, Protect+, Command
-- "unlimited" plan (if any) is preserved for NetNeural internal use
-- ============================================================================

-- Step 1: Rename old deactivated flat-rate plans to legacy_ prefix
-- (These were deactivated by 20260226230000_billing_plans_per_sensor.sql)
UPDATE billing_plans SET slug = 'legacy_starter'      WHERE slug = 'starter'      AND is_active = false;
UPDATE billing_plans SET slug = 'legacy_professional' WHERE slug = 'professional' AND is_active = false;
UPDATE billing_plans SET slug = 'legacy_enterprise'   WHERE slug = 'enterprise'   AND is_active = false;
UPDATE billing_plans SET slug = 'legacy_free'         WHERE slug = 'free'         AND is_active = false;

-- Step 2: Rename active per-sensor plans from marketing slugs to canonical tier names
UPDATE billing_plans SET slug = 'starter'      WHERE slug = 'monitor';
UPDATE billing_plans SET slug = 'professional' WHERE slug = 'protect';
UPDATE billing_plans SET slug = 'enterprise'   WHERE slug = 'command';

-- Update any organizations still referencing old tier names
UPDATE organizations SET subscription_tier = 'starter'      WHERE subscription_tier = 'monitor';
UPDATE organizations SET subscription_tier = 'professional' WHERE subscription_tier = 'protect';
UPDATE organizations SET subscription_tier = 'enterprise'   WHERE subscription_tier = 'command';

-- Verify the results
DO $$
DECLARE
  old_count INTEGER;
BEGIN
  -- Ensure no active plans still have old marketing slugs
  SELECT COUNT(*) INTO old_count
    FROM billing_plans
   WHERE slug IN ('monitor', 'protect', 'command');

  IF old_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % billing_plans still have old slugs', old_count;
  END IF;

  SELECT COUNT(*) INTO old_count
    FROM organizations
   WHERE subscription_tier IN ('monitor', 'protect', 'command');

  IF old_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % organizations still have old tier names', old_count;
  END IF;

  RAISE NOTICE 'Slug rename complete — billing_plans and organizations aligned to starter/professional/enterprise';
  RAISE NOTICE 'Legacy flat-rate plans renamed to legacy_* prefix';
END $$;
