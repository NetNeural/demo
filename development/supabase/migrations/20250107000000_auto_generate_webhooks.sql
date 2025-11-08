-- Migration: Auto-generate webhook URLs and secrets for integrations
-- Description: Automatically populate webhook_url and webhook_secret fields when integration is created/updated
-- Date: 2025-01-07

-- Enable pgcrypto extension for gen_random_bytes function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to generate webhook URL based on integration type and ID
CREATE OR REPLACE FUNCTION generate_webhook_url(
  integration_id UUID,
  integration_type TEXT,
  supabase_url TEXT DEFAULT current_setting('app.settings.supabase_url', TRUE)
)
RETURNS TEXT AS $$
DECLARE
  base_url TEXT;
  webhook_endpoint TEXT;
BEGIN
  -- Get Supabase URL from settings or use default
  base_url := COALESCE(supabase_url, 'http://localhost:54321');
  
  -- Determine webhook endpoint based on integration type
  webhook_endpoint := CASE integration_type
    WHEN 'golioth' THEN 'golioth-webhook'
    WHEN 'aws_iot' THEN 'aws-iot-webhook'
    WHEN 'aws-iot' THEN 'aws-iot-webhook'
    WHEN 'azure_iot' THEN 'azure-iot-webhook'
    WHEN 'azure-iot' THEN 'azure-iot-webhook'
    WHEN 'google_iot' THEN 'google-iot-webhook'
    WHEN 'google-iot' THEN 'google-iot-webhook'
    WHEN 'mqtt' THEN 'mqtt-webhook'
    ELSE NULL
  END;
  
  -- Return NULL if integration type doesn't support webhooks
  IF webhook_endpoint IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Construct full webhook URL
  RETURN base_url || '/functions/v1/' || webhook_endpoint || '?integration_id=' || integration_id::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate secure webhook secret
CREATE OR REPLACE FUNCTION generate_webhook_secret()
RETURNS TEXT AS $$
BEGIN
  -- Use gen_random_uuid() which is always available in Postgres
  RETURN replace(gen_random_uuid()::TEXT, '-', '') || replace(gen_random_uuid()::TEXT, '-', '');
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Trigger function to auto-populate webhook fields
CREATE OR REPLACE FUNCTION auto_generate_webhook_config()
RETURNS TRIGGER AS $$
DECLARE
  needs_webhook BOOLEAN;
BEGIN
  -- Check if integration type supports webhooks
  needs_webhook := NEW.integration_type IN ('golioth', 'aws_iot', 'aws-iot', 'azure_iot', 'azure-iot', 'google_iot', 'google-iot', 'mqtt');
  
  IF needs_webhook THEN
    -- Generate webhook URL if not set
    IF NEW.webhook_url IS NULL OR NEW.webhook_url = '' THEN
      NEW.webhook_url := generate_webhook_url(NEW.id, NEW.integration_type);
    END IF;
    
    -- Generate webhook secret if not set
    IF NEW.webhook_secret IS NULL OR NEW.webhook_secret = '' THEN
      NEW.webhook_secret := generate_webhook_secret();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_generate_webhook_config ON device_integrations;

-- Create trigger on INSERT and UPDATE
CREATE TRIGGER trigger_auto_generate_webhook_config
  BEFORE INSERT OR UPDATE ON device_integrations
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_webhook_config();

-- Ensure webhook columns exist (they should from 20251027000002, but safe to check)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'device_integrations' AND column_name = 'webhook_url'
  ) THEN
    ALTER TABLE device_integrations ADD COLUMN webhook_url VARCHAR(500);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'device_integrations' AND column_name = 'webhook_secret'
  ) THEN
    ALTER TABLE device_integrations ADD COLUMN webhook_secret VARCHAR(255);
  END IF;
END $$;

-- Backfill existing integrations with webhook URLs and secrets (only if columns exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'device_integrations' AND column_name = 'webhook_url'
  ) THEN
    UPDATE device_integrations
    SET 
      webhook_url = generate_webhook_url(id, integration_type),
      webhook_secret = generate_webhook_secret()
    WHERE 
      integration_type IN ('golioth', 'aws_iot', 'aws-iot', 'azure_iot', 'azure-iot', 'google_iot', 'google-iot', 'mqtt')
      AND (webhook_url IS NULL OR webhook_url = '' OR webhook_secret IS NULL OR webhook_secret = '');
  END IF;
END $$;


-- Add helpful comment
COMMENT ON FUNCTION generate_webhook_url IS 'Generates webhook URL for IoT platform integrations based on integration ID and type';
COMMENT ON FUNCTION generate_webhook_secret IS 'Generates a secure random webhook secret using crypto-secure random bytes';
COMMENT ON FUNCTION auto_generate_webhook_config IS 'Trigger function that auto-populates webhook_url and webhook_secret for IoT integrations';
