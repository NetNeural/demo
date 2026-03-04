-- Migration: rename plan slug 'professional' → 'business'
-- Affects: billing_plans, organizations, tier_features (if slug-keyed), subscriptions
-- Date: 2026-03-03

BEGIN;

-- 1. billing_plans: rename active 'professional' slug to 'business'
UPDATE billing_plans
SET slug = 'business', name = 'Business', updated_at = now()
WHERE slug = 'professional' AND is_active = true;

-- 2. billing_plans: rename legacy/inactive 'professional' slug (keep legacy prefix intact, add alias)
UPDATE billing_plans
SET slug = 'legacy_business', name = 'Business (Legacy)', updated_at = now()
WHERE slug = 'legacy_professional';

-- 3. organizations: sync subscription_tier
UPDATE organizations
SET subscription_tier = 'business', updated_at = now()
WHERE subscription_tier = 'professional';

-- 4. tier_features table (tier column)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tier_features'
  ) THEN
    EXECUTE 'UPDATE tier_features SET tier = ''business'' WHERE tier = ''professional''';
  END IF;
END $$;

-- 5. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE 'Renamed professional -> business in billing_plans, organizations, and tier_features';
END $$;

COMMIT;
