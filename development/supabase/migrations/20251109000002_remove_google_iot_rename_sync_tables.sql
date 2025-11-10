-- Migration: Remove Google IoT Core and rename sync tables to generic
-- Date: 2025-11-09
-- Issue: #82 - Complete Integration Provider Implementation
--
-- Google IoT Core was discontinued by Google in August 2023
-- This migration removes it from the system and renames Golioth-specific
-- tables to generic integration tables for multi-provider support

-- Step 1: Remove google_iot from integration_type constraint
ALTER TABLE device_integrations
DROP CONSTRAINT IF EXISTS device_integrations_integration_type_check;

ALTER TABLE device_integrations
ADD CONSTRAINT device_integrations_integration_type_check
CHECK (integration_type IN (
  'golioth',
  'aws_iot',
  'azure_iot',
  'mqtt',
  'smtp',
  'slack',
  'webhook'
));

-- Step 2: Delete any existing google_iot integrations (if any)
DELETE FROM device_integrations WHERE integration_type = 'google_iot';

-- Step 3: Rename golioth_sync_log table to integration_sync_log
ALTER TABLE IF EXISTS golioth_sync_log
RENAME TO integration_sync_log;

-- Step 4: Rename golioth_sync_log_id_seq sequence
ALTER SEQUENCE IF EXISTS golioth_sync_log_id_seq
RENAME TO integration_sync_log_id_seq;

-- Step 5: Add external_device_id column if not exists (replacing golioth_device_id)
ALTER TABLE IF EXISTS integration_sync_log
ADD COLUMN IF NOT EXISTS external_device_id VARCHAR(255);

-- Step 6: Add provider_type column if not exists
ALTER TABLE IF EXISTS integration_sync_log
ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50);

-- Step 7: Populate provider_type from device_integrations
UPDATE integration_sync_log isl
SET provider_type = di.integration_type
FROM device_integrations di
WHERE isl.integration_id = di.id
AND isl.provider_type IS NULL;

-- Step 8: Create index on provider_type for performance
CREATE INDEX IF NOT EXISTS idx_integration_sync_log_provider_type
ON integration_sync_log(provider_type);

-- Step 9: Create index on external_device_id for lookups
CREATE INDEX IF NOT EXISTS idx_integration_sync_log_external_device_id
ON integration_sync_log(external_device_id);

-- Step 10: Add comment to table
COMMENT ON TABLE integration_sync_log IS 'Generic sync log for all integration providers (Golioth, AWS IoT, Azure IoT, MQTT, etc.)';

-- Step 11: Verify migration
DO $$
DECLARE
  google_iot_count INTEGER;
  old_table_exists BOOLEAN;
BEGIN
  -- Check for google_iot integrations
  SELECT COUNT(*) INTO google_iot_count
  FROM device_integrations
  WHERE integration_type = 'google_iot';
  
  IF google_iot_count > 0 THEN
    RAISE WARNING 'Found % google_iot integrations that should have been deleted', google_iot_count;
  END IF;
  
  -- Check if old table still exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'golioth_sync_log'
  ) INTO old_table_exists;
  
  IF old_table_exists THEN
    RAISE WARNING 'Old table golioth_sync_log still exists';
  END IF;
  
  RAISE NOTICE 'Migration completed successfully';
  RAISE NOTICE 'Google IoT integrations removed: %', google_iot_count;
  RAISE NOTICE 'Sync log table renamed: golioth_sync_log -> integration_sync_log';
END $$;
