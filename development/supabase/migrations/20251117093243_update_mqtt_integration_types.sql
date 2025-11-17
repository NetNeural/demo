-- ============================================================================
-- Update MQTT Integration Types
-- ============================================================================
-- Split MQTT into two separate integration types:
-- - mqtt_hosted: NetNeural managed broker (auto-credentials)
-- - mqtt_external: Customer's own MQTT broker
-- ============================================================================

BEGIN;

-- Drop old constraint
ALTER TABLE device_integrations 
DROP CONSTRAINT IF EXISTS device_integrations_integration_type_check;

-- Add new constraint with mqtt_hosted and mqtt_external
ALTER TABLE device_integrations 
ADD CONSTRAINT device_integrations_integration_type_check 
CHECK (integration_type IN (
  'golioth',        -- Golioth IoT platform
  'aws_iot',        -- AWS IoT Core
  'azure_iot',      -- Azure IoT Hub
  'google_iot',     -- Google Cloud IoT (deprecated but kept for compatibility)
  'email',          -- Email notifications
  'slack',          -- Slack messaging
  'webhook',        -- Custom HTTP webhooks
  'mqtt',           -- Generic MQTT (legacy, kept for compatibility)
  'mqtt_hosted',    -- NetNeural managed MQTT broker
  'mqtt_external',  -- Customer's own MQTT broker
  'netneural_hub'   -- NetNeural Hub integration
));

COMMIT;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 'mqtt' type is kept for backwards compatibility with existing integrations
-- New MQTT integrations should use 'mqtt_hosted' or 'mqtt_external'
-- 'google_iot' is deprecated but kept for any existing integrations
