-- ============================================================
-- Fix: Starter tier should start at 0 sensors, not 1
--
-- With min_sensors=1, organizations with 0 sensors don't match
-- any tier, causing the tier engine to leave nextTier=null
-- which the UI interprets as "Maximum Tier" (Platinum).
-- ============================================================

UPDATE reseller_tiers
SET min_sensors = 0
WHERE name = 'Starter' AND min_sensors = 1;
