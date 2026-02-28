-- ============================================================================
-- Link devices to device_types (Issue #119)
-- Adds device_type_id FK to devices table for configuration inheritance
-- ============================================================================

-- 1. Add the nullable FK column (existing devices won't have a type assigned yet)
ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS device_type_id UUID REFERENCES device_types(id) ON DELETE SET NULL;

-- 2. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_devices_device_type_id ON devices(device_type_id)
    WHERE device_type_id IS NOT NULL;

-- 3. Composite index for org + type lookups
CREATE INDEX IF NOT EXISTS idx_devices_org_device_type_id ON devices(organization_id, device_type_id)
    WHERE device_type_id IS NOT NULL;

-- 4. Comment
COMMENT ON COLUMN devices.device_type_id IS 'FK to device_types table for inherited configuration (normal ranges, thresholds, units). The legacy device_type VARCHAR column is retained for display/backward compat.';
