-- Add NetNeural Hub integration type
-- This enables a single integration to manage all NetNeural custom devices
-- with support for multiple protocols (CoAP, MQTT, HTTPS) and device types

-- Add netneural_hub to integration types
ALTER TABLE device_integrations DROP CONSTRAINT device_integrations_integration_type_check;
ALTER TABLE device_integrations ADD CONSTRAINT device_integrations_integration_type_check 
  CHECK (integration_type IN (
    'golioth',
    'aws_iot',
    'azure_iot',
    'google_iot',
    'email',
    'slack',
    'webhook',
    'mqtt',
    'netneural_hub'  -- NEW: Multi-protocol NetNeural device hub
  ));

-- Create device capabilities table for extensible device type support
CREATE TABLE IF NOT EXISTS device_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_type TEXT NOT NULL, -- 'nrf9151_cellular', 'nrf52840_ble', 'universal_sensor_v2', etc.
  capability TEXT NOT NULL,  -- 'temperature', 'pressure', 'ota_update', 'coap', 'mqtt', etc.
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast capability lookups
CREATE INDEX idx_device_capabilities_type ON device_capabilities(device_type);
CREATE INDEX idx_device_capabilities_capability ON device_capabilities(capability);
CREATE UNIQUE INDEX idx_device_capabilities_unique ON device_capabilities(device_type, capability);

-- Add device_type to devices table for NetNeural Hub routing
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_type TEXT;
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(device_type);

-- Insert default capabilities for known NetNeural devices
INSERT INTO device_capabilities (device_type, capability, metadata) VALUES
-- nRF9151 Cellular Gateways
('nrf9151_cellular', 'temperature_sensor', '{"range": "-40 to +85°C", "accuracy": "±0.5°C"}'),
('nrf9151_cellular', 'cellular_connectivity', '{"bands": ["LTE-M", "NB-IoT"], "power": "23dBm"}'),
('nrf9151_cellular', 'coap_protocol', '{"version": "RFC7252", "dtls": true}'),
('nrf9151_cellular', 'mqtt_protocol', '{"version": "3.1.1", "tls": true}'),
('nrf9151_cellular', 'ota_updates', '{"method": "coap", "verification": "sha256"}'),
('nrf9151_cellular', 'low_power_mode', '{"sleep_current": "2.7μA", "wakeup_time": "5ms"}'),
('nrf9151_cellular', 'edge_processing', '{"cpu": "ARM Cortex-M33", "ram": "256KB", "flash": "1MB"}'),

-- nRF52840 BLE Devices  
('nrf52840_ble', 'temperature_sensor', '{"range": "-40 to +85°C", "accuracy": "±0.5°C"}'),
('nrf52840_ble', 'ble_connectivity', '{"version": "5.2", "range": "100m", "power": "+8dBm"}'),
('nrf52840_ble', 'thread_protocol', '{"version": "1.3", "mesh": true}'),
('nrf52840_ble', 'zigbee_protocol', '{"version": "3.0", "mesh": true}'),
('nrf52840_ble', 'nfc_config', '{"type": "Type 4", "memory": "8KB"}'),
('nrf52840_ble', 'ota_updates', '{"method": "ble", "verification": "sha256"}'),
('nrf52840_ble', 'low_power_mode', '{"sleep_current": "0.3μA", "wakeup_time": "5ms"}'),

-- Universal Sensor 2.0 (Future)
('universal_sensor_v2', 'modular_design', '{"sensor_shoes": true, "hot_swap": true}'),
('universal_sensor_v2', 'multi_protocol', '{"protocols": ["BLE", "Thread", "Zigbee", "LoRaWAN"]}'),
('universal_sensor_v2', 'battery_life', '{"type": "ER32L100", "life": "3-5 years"}'),
('universal_sensor_v2', 'sensor_array', '{"temperature": true, "humidity": true, "pressure": true, "motion": true}'),

-- VMark Protocol Devices
('vmark_sensor', 'vmark_protocol', '{"format": "json", "fields": ["device", "handle", "paras", "time"]}'),
('vmark_sensor', 'edge_gateway', '{"service": "edge-vmark-input", "caching": true}'),
('vmark_sensor', 'cloud_gateway', '{"service": "vmark-cloud-gateway", "aggregation": true}')

ON CONFLICT (device_type, capability) DO NOTHING;

-- Create protocol endpoints table for NetNeural Hub configuration
CREATE TABLE IF NOT EXISTS netneural_hub_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES device_integrations(id) ON DELETE CASCADE,
  protocol TEXT NOT NULL, -- 'coap', 'mqtt', 'https'
  endpoint_url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_netneural_hub_endpoints_integration ON netneural_hub_endpoints(integration_id);
CREATE INDEX idx_netneural_hub_endpoints_protocol ON netneural_hub_endpoints(protocol);

-- Enable RLS for new tables
ALTER TABLE device_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE netneural_hub_endpoints ENABLE ROW LEVEL SECURITY;

-- RLS policies for device_capabilities (read-only for most users)
CREATE POLICY "Everyone can view device capabilities" ON device_capabilities
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage capabilities" ON device_capabilities
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
  );

-- RLS policies for netneural_hub_endpoints
CREATE POLICY "Users can view organization hub endpoints" ON netneural_hub_endpoints
  FOR SELECT TO authenticated
  USING (
    integration_id IN (
      SELECT di.id 
      FROM device_integrations di
      WHERE di.organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        WHERE om.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage organization hub endpoints" ON netneural_hub_endpoints
  FOR ALL TO authenticated
  USING (
    integration_id IN (
      SELECT di.id 
      FROM device_integrations di
      WHERE di.organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        WHERE om.user_id = auth.uid() 
        AND om.role IN ('admin', 'owner')
      )
    )
  );

-- Add updated_at triggers
CREATE TRIGGER update_device_capabilities_updated_at
  BEFORE UPDATE ON device_capabilities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_netneural_hub_endpoints_updated_at
  BEFORE UPDATE ON netneural_hub_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();