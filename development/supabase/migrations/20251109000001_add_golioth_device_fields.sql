-- ============================================================================
-- Migration: Add Missing Golioth Device Fields
-- ============================================================================
-- Date: 2025-11-09
-- Issue: #80 - Capture missing Golioth device fields
-- Description: Adds new columns to capture additional Golioth data:
--   - last_seen_online: When device last connected
--   - last_seen_offline: When device last disconnected
--   - hardware_ids: Array of hardware identifiers (not just single value)
--   - cohort_id: OTA update group assignment
--
-- Safety: All new columns are nullable - NON-BREAKING change
-- ============================================================================

-- Add new timestamp columns for connection tracking
ALTER TABLE devices 
  ADD COLUMN IF NOT EXISTS last_seen_online TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_seen_offline TIMESTAMP WITH TIME ZONE;

-- Add hardware IDs array (supports multiple identifiers per device)
ALTER TABLE devices 
  ADD COLUMN IF NOT EXISTS hardware_ids TEXT[];

-- Add cohort ID for OTA update group management
ALTER TABLE devices 
  ADD COLUMN IF NOT EXISTS cohort_id VARCHAR(255);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_devices_last_seen_online 
  ON devices(last_seen_online);

CREATE INDEX IF NOT EXISTS idx_devices_last_seen_offline 
  ON devices(last_seen_offline);

CREATE INDEX IF NOT EXISTS idx_devices_cohort_id 
  ON devices(cohort_id);

CREATE INDEX IF NOT EXISTS idx_devices_hardware_ids 
  ON devices USING GIN(hardware_ids);

-- Add helpful comment for documentation
COMMENT ON COLUMN devices.last_seen_online IS 'Timestamp when device last connected to Golioth (from metadata.lastSeenOnline)';
COMMENT ON COLUMN devices.last_seen_offline IS 'Timestamp when device last disconnected from Golioth (from metadata.lastSeenOffline)';
COMMENT ON COLUMN devices.hardware_ids IS 'Array of hardware identifiers from Golioth (supports multiple IDs per device)';
COMMENT ON COLUMN devices.cohort_id IS 'Golioth cohort ID for OTA update group management';
