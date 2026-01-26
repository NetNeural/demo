-- Migration: Firmware History Log (Issue #81)
-- Date: 2026-01-26
-- Description: Creates append-only firmware history log with auto-update trigger

-- Create firmware history table (append-only log)
CREATE TABLE IF NOT EXISTS device_firmware_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  firmware_version TEXT NOT NULL,
  component_type TEXT, -- 'main', 'cellgateway', 'modsensor', NULL for legacy/unknown
  installed_at TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'ota_update' CHECK (source IN ('ota_update', 'manual_provision', 'factory_default', 'unknown')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient "most recent version" queries
CREATE INDEX IF NOT EXISTS idx_firmware_history_device_recent 
  ON device_firmware_history(device_id, installed_at DESC);

-- Index for component-specific queries
CREATE INDEX IF NOT EXISTS idx_firmware_history_component 
  ON device_firmware_history(device_id, component_type, installed_at DESC) 
  WHERE component_type IS NOT NULL;

-- Function to auto-update devices.firmware_version from most recent log entry
CREATE OR REPLACE FUNCTION update_device_firmware_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Update devices.firmware_version to most recent main component (or any if no component specified)
  UPDATE devices
  SET firmware_version = NEW.firmware_version,
      updated_at = now()
  WHERE id = NEW.device_id
    AND (NEW.component_type = 'main' OR NEW.component_type IS NULL);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update on insert
DROP TRIGGER IF EXISTS trg_update_firmware_version ON device_firmware_history;
CREATE TRIGGER trg_update_firmware_version
  AFTER INSERT ON device_firmware_history
  FOR EACH ROW
  EXECUTE FUNCTION update_device_firmware_version();

-- Comments
COMMENT ON TABLE device_firmware_history IS 'Append-only log of firmware versions (Issue #81)';
COMMENT ON COLUMN device_firmware_history.component_type IS 'Firmware component (main, cellgateway, modsensor) or NULL for monolithic';
COMMENT ON COLUMN device_firmware_history.source IS 'How firmware was installed (OTA, manual, factory)';
