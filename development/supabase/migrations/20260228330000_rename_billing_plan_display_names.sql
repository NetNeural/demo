-- ============================================================================
-- Migration: Update billing_plans display names to match new tier naming
-- Date: 2026-02-28
-- Purpose: Rename plan display names from Monitor/Protect+/Command
--          to Starter/Professional/Enterprise
--
-- The old deactivated flat-rate plans already use names Starter/Professional/
-- Enterprise (from the original billing_plans seed). Rename those first to
-- avoid the unique constraint on billing_plans.name.
-- ============================================================================

-- Step 1: Prefix old deactivated plans that hold the target names
UPDATE billing_plans SET name = 'Legacy Starter'      WHERE slug = 'legacy_starter'      AND name = 'Starter';
UPDATE billing_plans SET name = 'Legacy Professional' WHERE slug = 'legacy_professional' AND name = 'Professional';
UPDATE billing_plans SET name = 'Legacy Enterprise'   WHERE slug = 'legacy_enterprise'   AND name = 'Enterprise';
UPDATE billing_plans SET name = 'Legacy Free'         WHERE slug = 'legacy_free'         AND name = 'Free';

-- Step 2: Rename active per-sensor plans to new canonical names
UPDATE billing_plans SET name = 'Starter'      WHERE slug = 'starter'      AND name = 'Monitor';
UPDATE billing_plans SET name = 'Professional' WHERE slug = 'professional' AND name = 'Protect+';
UPDATE billing_plans SET name = 'Enterprise'   WHERE slug = 'enterprise'   AND name = 'Command';
