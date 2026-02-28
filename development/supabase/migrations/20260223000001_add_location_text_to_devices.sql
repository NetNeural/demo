-- ============================================================================
-- Add free-text location column to devices
-- The devices table only had location_id (FK to locations table), but the
-- UI collects a free-text location string. Add a simple text column so
-- AddDeviceDialog and TestDeviceDialog can store it directly.
-- ============================================================================

ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS location TEXT;

COMMENT ON COLUMN devices.location IS 'Free-text location description (e.g. "Building A, Floor 2"). Separate from location_id FK which links to the structured locations table.';
