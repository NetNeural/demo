-- Migration: Add Missing Golioth Device Fields (Issue #80)
-- Date: 2026-01-26
-- Description: Adds fields for last_seen_online, last_seen_offline, hardware_ids, cohort_id, golioth_status

-- Add missing fields to devices table
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS last_seen_online TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_offline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hardware_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cohort_id TEXT,
  ADD COLUMN IF NOT EXISTS golioth_status TEXT CHECK (golioth_status IN ('enabled', 'disabled', 'suspended'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_devices_last_seen_online 
  ON devices(last_seen_online DESC) WHERE last_seen_online IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_devices_cohort_id 
  ON devices(cohort_id) WHERE cohort_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_devices_hardware_ids 
  ON devices USING GIN(hardware_ids);

-- Add comments for documentation
COMMENT ON COLUMN devices.last_seen_online IS 'Timestamp when device was last seen online (from Golioth)';
COMMENT ON COLUMN devices.last_seen_offline IS 'Timestamp when device last went offline (from Golioth)';
COMMENT ON COLUMN devices.hardware_ids IS 'Array of hardware identifiers (MAC addresses, IMEI, etc.)';
COMMENT ON COLUMN devices.cohort_id IS 'Golioth cohort ID for firmware deployment targeting';
COMMENT ON COLUMN devices.golioth_status IS 'Device status in Golioth platform (enabled/disabled/suspended)';
