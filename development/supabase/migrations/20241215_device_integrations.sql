-- Update device_integrations table to include constraints and indexes that might be missing
-- Add check constraints if they don't exist
DO $$ 
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_integrations_integration_type_check') THEN
    ALTER TABLE device_integrations DROP CONSTRAINT device_integrations_integration_type_check;
  END IF;
  
  -- Add updated constraint with all supported types
  ALTER TABLE device_integrations ADD CONSTRAINT device_integrations_integration_type_check 
    CHECK (integration_type IN (
      'golioth',      -- Golioth IoT platform for device management
      'aws_iot',      -- AWS IoT Core for cloud-connected devices
      'azure_iot',    -- Azure IoT Hub for enterprise IoT solutions
      'google_iot',   -- Google Cloud IoT Core
      'email',        -- Email/SMTP notifications
      'slack',        -- Slack messaging integration
      'webhook',      -- Custom HTTP webhooks for events
      'mqtt'          -- MQTT broker for pub/sub messaging
    ));
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_integrations_status_check') THEN
    ALTER TABLE device_integrations ADD CONSTRAINT device_integrations_status_check 
      CHECK (status IN ('active', 'inactive', 'error'));
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX idx_device_integrations_organization_id ON device_integrations(organization_id);
CREATE INDEX idx_device_integrations_type ON device_integrations(integration_type);
CREATE INDEX idx_device_integrations_status ON device_integrations(status);

-- Create unique constraint for organization + integration type + name
CREATE UNIQUE INDEX idx_device_integrations_unique ON device_integrations(organization_id, integration_type, name);

-- Enable RLS
ALTER TABLE device_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies for device_integrations
-- Super admins can see all integrations
CREATE POLICY "Super admins can view all integrations" ON device_integrations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
  );

-- Users can only see integrations for their organization
CREATE POLICY "Users can view organization integrations" ON device_integrations
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );

-- Super admins can insert integrations for any organization
CREATE POLICY "Super admins can create integrations" ON device_integrations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
  );

-- Admins can insert integrations for their organization only
CREATE POLICY "Admins can create organization integrations" ON device_integrations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('admin', 'owner')
    )
  );

-- Super admins can update all integrations
CREATE POLICY "Super admins can update all integrations" ON device_integrations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
  );

-- Admins can update integrations for their organization
CREATE POLICY "Admins can update organization integrations" ON device_integrations
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('admin', 'owner')
    )
  );

-- Super admins can delete all integrations
CREATE POLICY "Super admins can delete all integrations" ON device_integrations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
  );

-- Admins can delete integrations for their organization
CREATE POLICY "Admins can delete organization integrations" ON device_integrations
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('admin', 'owner')
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_device_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_device_integrations_updated_at_trigger
  BEFORE UPDATE ON device_integrations
  FOR EACH ROW EXECUTE FUNCTION update_device_integrations_updated_at();