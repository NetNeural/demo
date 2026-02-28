-- ============================================================================
-- Migration: Update billing_plans descriptions to match new tier names
-- Date: 2026-02-28
-- Purpose: Replace old Monitor/Protect/Command references in description text
-- ============================================================================

UPDATE billing_plans
SET description = 'Core compliance & visibility. Real-time monitoring, automated compliance logs, email & SMS alerting. $2 per sensor/month.',
    updated_at = now()
WHERE slug = 'starter' AND is_active = true;

UPDATE billing_plans
SET description = 'Operational intelligence. AI anomaly detection, predictive alerts, multi-site dashboard, API access, and 1-year data retention. $4 per sensor/month.',
    updated_at = now()
WHERE slug = 'professional' AND is_active = true;

UPDATE billing_plans
SET description = 'Full platform optimization. AI energy optimization, ESG & carbon analytics, chain benchmarking, custom integrations, dedicated support & SLA. $6 per sensor/month.',
    updated_at = now()
WHERE slug = 'enterprise' AND is_active = true;

-- Verify
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Check for old tier name references (not generic words like "monitoring")
  SELECT COUNT(*) INTO v_count
    FROM billing_plans
   WHERE is_active = true
     AND (description ILIKE '%Protect+%' OR description ILIKE '%Command %')
     AND slug IN ('starter', 'professional', 'enterprise');

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % active plans still reference old names in descriptions', v_count;
  END IF;

  RAISE NOTICE 'Plan descriptions updated for starter, professional, enterprise';
END $$;
