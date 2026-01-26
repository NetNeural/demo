-- Migration: Add Serial Number for Device Matching (Issue #83)
-- Date: 2026-01-26
-- Description: Adds serial_number column for primary device matching strategy

-- Add serial_number column (may already exist)
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS serial_number TEXT;

-- Create unique index for fast lookups
DROP INDEX IF EXISTS idx_devices_serial_number;
CREATE UNIQUE INDEX idx_devices_serial_number 
  ON devices(serial_number) 
  WHERE serial_number IS NOT NULL;

-- Populate from existing data (if available in metadata)
UPDATE devices
SET serial_number = metadata->>'serial_number'
WHERE serial_number IS NULL 
  AND metadata->>'serial_number' IS NOT NULL;

-- Add comment
COMMENT ON COLUMN devices.serial_number IS 'Unique device serial number (matches Golioth Device Name field for primary matching)';
