-- ============================================================================
-- INTEGRATION-AGNOSTIC TELEMETRY RECORDING
-- ============================================================================
-- Extend device_telemetry_history to work with ALL integrations, not just MQTT
-- Add integration_id to track source, modify helper functions
-- ============================================================================

-- Add integration_id column to track telemetry source
ALTER TABLE device_telemetry_history 
ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES device_integrations(id) ON DELETE CASCADE;

-- Add index for integration queries
CREATE INDEX IF NOT EXISTS idx_telemetry_integration 
  ON device_telemetry_history(integration_id, received_at DESC);

-- Update record_device_telemetry to accept integration_id
CREATE OR REPLACE FUNCTION record_device_telemetry(
  p_device_id UUID,
  p_organization_id UUID,
  p_telemetry JSONB,
  p_device_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_activity_log_id UUID DEFAULT NULL,
  p_integration_id UUID DEFAULT NULL  -- NEW: Track source integration
) RETURNS UUID AS $$
DECLARE
  v_new_id UUID;
BEGIN
  -- Insert telemetry record
  INSERT INTO device_telemetry_history (
    device_id,
    organization_id,
    telemetry,
    device_timestamp,
    activity_log_id,
    integration_id
  ) VALUES (
    p_device_id,
    p_organization_id,
    p_telemetry,
    COALESCE(p_device_timestamp, NOW()),
    p_activity_log_id,
    p_integration_id
  ) RETURNING id INTO v_new_id;
  
  -- Update device last_seen and cache latest telemetry
  UPDATE devices
  SET 
    last_seen = NOW(),
    updated_at = NOW(),
    metadata = CASE
      WHEN metadata IS NULL THEN jsonb_build_object('last_telemetry', p_telemetry, 'last_telemetry_source', COALESCE((SELECT type FROM device_integrations WHERE id = p_integration_id), 'unknown'))
      ELSE metadata || jsonb_build_object('last_telemetry', p_telemetry, 'last_telemetry_source', COALESCE((SELECT type FROM device_integrations WHERE id = p_integration_id), 'unknown'))
    END
  WHERE id = p_device_id;
  
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Extract telemetry from device metadata during sync
CREATE OR REPLACE FUNCTION extract_telemetry_from_metadata(p_metadata JSONB) 
RETURNS JSONB AS $$
DECLARE
  v_telemetry JSONB := '{}'::JSONB;
BEGIN
  -- Common telemetry fields across all integrations
  IF p_metadata ? 'battery_level' THEN
    v_telemetry := v_telemetry || jsonb_build_object('battery', (p_metadata->>'battery_level')::numeric);
  END IF;
  
  IF p_metadata ? 'temperature' THEN
    v_telemetry := v_telemetry || jsonb_build_object('temperature', (p_metadata->>'temperature')::numeric);
  END IF;
  
  IF p_metadata ? 'humidity' THEN
    v_telemetry := v_telemetry || jsonb_build_object('humidity', (p_metadata->>'humidity')::numeric);
  END IF;
  
  IF p_metadata ? 'rssi' OR p_metadata ? 'signal_strength' THEN
    v_telemetry := v_telemetry || jsonb_build_object('rssi', 
      COALESCE((p_metadata->>'rssi')::numeric, (p_metadata->>'signal_strength')::numeric)
    );
  END IF;
  
  IF p_metadata ? 'firmware_version' THEN
    v_telemetry := v_telemetry || jsonb_build_object('firmware_version', p_metadata->>'firmware_version');
  END IF;
  
  IF p_metadata ? 'uptime' OR p_metadata ? 'uptime_seconds' THEN
    v_telemetry := v_telemetry || jsonb_build_object('uptime', 
      COALESCE((p_metadata->>'uptime')::numeric, (p_metadata->>'uptime_seconds')::numeric)
    );
  END IF;
  
  -- AWS IoT specific
  IF p_metadata ? 'aws_attributes' THEN
    v_telemetry := v_telemetry || (p_metadata->'aws_attributes');
  END IF;
  
  -- Azure IoT specific  
  IF p_metadata ? 'azure_pending_messages' THEN
    v_telemetry := v_telemetry || jsonb_build_object('pending_messages', (p_metadata->>'azure_pending_messages')::numeric);
  END IF;
  
  -- Return extracted telemetry (or empty object if nothing found)
  RETURN v_telemetry;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-extract telemetry when device is updated during sync
CREATE OR REPLACE FUNCTION auto_record_telemetry_on_device_update()
RETURNS TRIGGER AS $$
DECLARE
  v_telemetry JSONB;
  v_integration_id UUID;
BEGIN
  -- Only trigger if metadata changed and contains telemetry fields
  IF NEW.metadata IS DISTINCT FROM OLD.metadata AND NEW.metadata IS NOT NULL THEN
    
    -- Extract telemetry from metadata
    v_telemetry := extract_telemetry_from_metadata(NEW.metadata);
    
    -- Only insert if we found telemetry data
    IF jsonb_object_keys(v_telemetry) IS NOT NULL THEN
      
      -- Try to determine integration_id from device
      SELECT id INTO v_integration_id
      FROM device_integrations
      WHERE organization_id = NEW.organization_id
        AND enabled = true
      LIMIT 1;  -- In multi-integration scenarios, this may need refinement
      
      -- Record telemetry
      PERFORM record_device_telemetry(
        p_device_id := NEW.id,
        p_organization_id := NEW.organization_id,
        p_telemetry := v_telemetry,
        p_device_timestamp := NEW.updated_at,
        p_activity_log_id := NULL,
        p_integration_id := v_integration_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on devices table
DROP TRIGGER IF EXISTS trigger_auto_record_telemetry ON devices;
CREATE TRIGGER trigger_auto_record_telemetry
  AFTER UPDATE ON devices
  FOR EACH ROW
  WHEN (NEW.metadata IS DISTINCT FROM OLD.metadata)
  EXECUTE FUNCTION auto_record_telemetry_on_device_update();

-- Comments
COMMENT ON COLUMN device_telemetry_history.integration_id IS 'Source integration (mqtt, golioth, aws_iot, azure_iot, etc.)';
COMMENT ON FUNCTION extract_telemetry_from_metadata IS 'Extracts telemetry fields from device metadata JSON';
COMMENT ON FUNCTION auto_record_telemetry_on_device_update IS 'Automatically records telemetry when device metadata is updated during sync';
COMMENT ON TRIGGER trigger_auto_record_telemetry ON devices IS 'Auto-creates telemetry history entries when sync updates device metadata';
