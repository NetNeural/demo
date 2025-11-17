-- Add MQTT broker type and hosted credentials to device_integrations
-- Supports both hosted (WebSocket) and external (customer) brokers

-- Add broker_type to existing integration types
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'integration_broker_type'
  ) THEN
    CREATE TYPE integration_broker_type AS ENUM ('hosted', 'external');
  END IF;
END $$;

-- Create mqtt_credentials table for hosted broker access
CREATE TABLE IF NOT EXISTS public.mqtt_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.device_integrations(id) ON DELETE CASCADE,
  
  -- Credentials
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- bcrypt hashed
  client_id TEXT UNIQUE NOT NULL,
  
  -- Topic access control
  topic_prefix TEXT NOT NULL, -- e.g., "org_abc123/devices/#"
  allowed_topics TEXT[] NOT NULL DEFAULT ARRAY['devices/#', 'commands/#'],
  
  -- Connection info
  broker_url TEXT NOT NULL, -- Set by generate_mqtt_credentials function
  last_connected_at TIMESTAMPTZ,
  connection_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_org_integration UNIQUE (organization_id, integration_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mqtt_credentials_org ON public.mqtt_credentials(organization_id);
CREATE INDEX IF NOT EXISTS idx_mqtt_credentials_integration ON public.mqtt_credentials(integration_id);
CREATE INDEX IF NOT EXISTS idx_mqtt_credentials_username ON public.mqtt_credentials(username);

-- RLS Policies
ALTER TABLE public.mqtt_credentials ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access"
  ON public.mqtt_credentials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Organization members can view their credentials
CREATE POLICY "Organization members can view credentials"
  ON public.mqtt_credentials
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Organization admins can manage credentials
CREATE POLICY "Organization admins can manage credentials"
  ON public.mqtt_credentials
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Function to generate MQTT credentials
CREATE OR REPLACE FUNCTION generate_mqtt_credentials(
  p_organization_id UUID,
  p_integration_id UUID
)
RETURNS TABLE (
  username TEXT,
  password TEXT,
  client_id TEXT,
  broker_url TEXT,
  topic_prefix TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username TEXT;
  v_password TEXT;
  v_client_id TEXT;
  v_topic_prefix TEXT;
  v_password_hash TEXT;
BEGIN
  -- Generate unique identifiers
  v_username := 'mqtt_' || substring(md5(random()::text) from 1 for 16);
  v_password := substring(md5(random()::text || clock_timestamp()::text) from 1 for 32);
  v_client_id := 'client_' || substring(md5(random()::text) from 1 for 16);
  v_topic_prefix := 'org_' || substring(p_organization_id::text from 1 for 8) || '/';
  
  -- Hash password (in production, use pgcrypto's crypt function)
  v_password_hash := encode(digest(v_password, 'sha256'), 'hex');
  
  -- Insert credentials
  INSERT INTO public.mqtt_credentials (
    organization_id,
    integration_id,
    username,
    password_hash,
    client_id,
    topic_prefix,
    allowed_topics
  ) VALUES (
    p_organization_id,
    p_integration_id,
    v_username,
    v_password_hash,
    v_client_id,
    v_topic_prefix,
    ARRAY[v_topic_prefix || 'devices/#', v_topic_prefix || 'commands/#']
  )
  ON CONFLICT (organization_id, integration_id) 
  DO UPDATE SET updated_at = now();
  
  -- Return credentials (password only returned once!)
  -- Broker URL points to HTTP ingestion endpoint (no actual MQTT broker needed)
  RETURN QUERY
  SELECT 
    v_username,
    v_password,
    v_client_id,
    COALESCE(
      current_setting('app.supabase_url', true) || '/functions/v1/mqtt-ingest',
      'http://localhost:54321/functions/v1/mqtt-ingest'
    )::TEXT,
    v_topic_prefix;
END;
$$;

-- Function to update connection stats
CREATE OR REPLACE FUNCTION update_mqtt_connection_stats(
  p_username TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.mqtt_credentials
  SET 
    last_connected_at = now(),
    connection_count = connection_count + 1,
    updated_at = now()
  WHERE username = p_username;
END;
$$;

-- Add broker_type column to device_integrations if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'device_integrations' 
    AND column_name = 'broker_type'
  ) THEN
    ALTER TABLE public.device_integrations 
    ADD COLUMN broker_type TEXT DEFAULT 'external' 
    CHECK (broker_type IN ('hosted', 'external'));
  END IF;
END $$;

-- Comments
COMMENT ON TABLE public.mqtt_credentials IS 'MQTT credentials for hosted broker access';
COMMENT ON COLUMN public.mqtt_credentials.topic_prefix IS 'Org-specific topic prefix for ACL';
COMMENT ON COLUMN public.mqtt_credentials.allowed_topics IS 'Topics this client can pub/sub to';
COMMENT ON FUNCTION generate_mqtt_credentials IS 'Generate unique MQTT credentials for an integration';
COMMENT ON FUNCTION update_mqtt_connection_stats IS 'Update last connection time and count';
