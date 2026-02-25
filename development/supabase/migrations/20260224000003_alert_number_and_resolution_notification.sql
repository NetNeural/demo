-- Migration: Add alert_number for human-readable identification
-- Also add index for quick lookups

-- Add alert_number column (sequential per organization)
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_number INTEGER;

-- Create a function to auto-assign alert_number on insert
CREATE OR REPLACE FUNCTION assign_alert_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Get next alert number for this organization
  SELECT COALESCE(MAX(alert_number), 0) + 1
  INTO NEW.alert_number
  FROM alerts
  WHERE organization_id = NEW.organization_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-assign on insert
DROP TRIGGER IF EXISTS trg_assign_alert_number ON alerts;
CREATE TRIGGER trg_assign_alert_number
  BEFORE INSERT ON alerts
  FOR EACH ROW
  WHEN (NEW.alert_number IS NULL)
  EXECUTE FUNCTION assign_alert_number();

-- Backfill existing alerts with sequential numbers per organization
WITH numbered AS (
  SELECT id, organization_id,
    ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at) AS rn
  FROM alerts
  WHERE alert_number IS NULL
)
UPDATE alerts
SET alert_number = numbered.rn
FROM numbered
WHERE alerts.id = numbered.id;

-- Create index for fast lookups by org + alert_number
CREATE INDEX IF NOT EXISTS idx_alerts_org_number ON alerts(organization_id, alert_number);

COMMENT ON COLUMN alerts.alert_number IS 'Human-readable sequential alert number per organization (e.g., ALT-42)';
