-- ============================================================================
-- Test Device Support
-- Allows creating fake/test devices for development and testing
-- ============================================================================

-- Add is_test_device flag to devices table
ALTER TABLE devices 
    ADD COLUMN IF NOT EXISTS is_test_device BOOLEAN DEFAULT false NOT NULL;

-- Add index for filtering test devices
CREATE INDEX IF NOT EXISTS idx_devices_is_test ON devices(is_test_device)
    WHERE is_test_device = true;

-- Add composite index for org + test device queries
CREATE INDEX IF NOT EXISTS idx_devices_org_is_test ON devices(organization_id, is_test_device);

-- Add comment
COMMENT ON COLUMN devices.is_test_device IS 'Flag indicating this is a test/fake device for development and testing purposes. Test devices can be controlled via the UI to simulate telemetry data, alerts, and error states.';
