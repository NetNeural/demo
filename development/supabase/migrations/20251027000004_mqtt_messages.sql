-- ============================================================================
-- MQTT Messages Table Migration
-- ============================================================================
-- Stores messages received from MQTT broker subscriptions
-- Date: 2025-10-27
-- ============================================================================

-- Create mqtt_messages table
CREATE TABLE IF NOT EXISTS mqtt_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES device_integrations(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  qos INTEGER DEFAULT 0 CHECK (qos IN (0, 1, 2)),
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_mqtt_messages_org ON mqtt_messages(organization_id);
CREATE INDEX idx_mqtt_messages_integration ON mqtt_messages(integration_id);
CREATE INDEX idx_mqtt_messages_topic ON mqtt_messages(topic);
CREATE INDEX idx_mqtt_messages_received ON mqtt_messages(received_at DESC);

-- Enable RLS
ALTER TABLE mqtt_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "org_members_view_mqtt_messages" ON mqtt_messages
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "system_manage_mqtt_messages" ON mqtt_messages
  FOR ALL
  USING (true);

-- Add comment
COMMENT ON TABLE mqtt_messages IS 'Stores MQTT messages received from broker subscriptions';
