-- Add soft delete column to devices table
-- This allows devices to be marked as deleted without removing them from the database
-- Fixes issue #56: Organization page showing incorrect device count

ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for better query performance when filtering out deleted devices
CREATE INDEX IF NOT EXISTS idx_devices_deleted_at ON devices(deleted_at);

-- Add comment to document the column
COMMENT ON COLUMN devices.deleted_at IS 'Timestamp when the device was soft-deleted. NULL means the device is active.';
