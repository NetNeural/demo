-- ============================================================================
-- ADD DEVICE COUNT COLUMNS TO INTEGRATION_ACTIVITY_LOG
-- ============================================================================
-- Adds device sync tracking columns for better UI feedback
-- Allows frontend to display summary without parsing logs
-- 
-- Version: 1.0.0
-- Date: 2026-02-15
-- ============================================================================

BEGIN;

-- Add device tracking columns to integration_activity_log
ALTER TABLE integration_activity_log
  ADD COLUMN IF NOT EXISTS devices_processed INTEGER,
  ADD COLUMN IF NOT EXISTS devices_succeeded INTEGER,
  ADD COLUMN IF NOT EXISTS devices_failed INTEGER;

-- Create index for sync operations with device counts
CREATE INDEX IF NOT EXISTS idx_activity_log_sync_devices 
  ON integration_activity_log(activity_type, created_at DESC)
  WHERE activity_type IN ('sync_import', 'sync_export', 'sync_bidirectional')
    AND devices_processed IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN integration_activity_log.devices_processed IS 'Total number of devices processed during sync operation';
COMMENT ON COLUMN integration_activity_log.devices_succeeded IS 'Number of devices successfully synced';
COMMENT ON COLUMN integration_activity_log.devices_failed IS 'Number of devices that failed to sync';

COMMIT;
