-- Migration: Add category field to alerts table
-- Issue #108 prerequisite - enables alert grouping by category
-- Date: 2025-12-16

-- Add category column (nullable first for backfill)
ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- Add check constraint for valid categories
ALTER TABLE alerts 
ADD CONSTRAINT alerts_category_check 
CHECK (category IN ('temperature', 'connectivity', 'battery', 'vibration', 'security', 'system'));

-- Backfill existing alerts based on alert_type
UPDATE alerts 
SET category = CASE 
  WHEN alert_type ILIKE '%temperature%' OR alert_type ILIKE '%temp%' THEN 'temperature'
  WHEN alert_type ILIKE '%offline%' OR alert_type ILIKE '%connectivity%' OR alert_type ILIKE '%connection%' THEN 'connectivity'
  WHEN alert_type ILIKE '%battery%' THEN 'battery'
  WHEN alert_type ILIKE '%vibration%' OR alert_type ILIKE '%motion%' THEN 'vibration'
  WHEN alert_type ILIKE '%security%' OR alert_type ILIKE '%unauthorized%' OR alert_type ILIKE '%breach%' THEN 'security'
  ELSE 'system'
END
WHERE category IS NULL;

-- Make category NOT NULL after backfill
ALTER TABLE alerts 
ALTER COLUMN category SET NOT NULL;

-- Set default for new alerts
ALTER TABLE alerts 
ALTER COLUMN category SET DEFAULT 'system';

-- Add index for filtering by category
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_alerts_category_severity ON alerts(organization_id, category, severity, is_resolved);

-- Add comment
COMMENT ON COLUMN alerts.category IS 'Alert category for grouping: temperature, connectivity, battery, vibration, security, system';
