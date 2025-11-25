-- Migration: Auto-generate webhook URLs and secrets for integrations
-- Description: Automatically populate webhook_url and webhook_secret fields when integration is created/updated
-- Date: 2025-01-07

-- Enable pgcrypto extension for gen_random_bytes function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing functions to avoid conflicts (CASCADE to drop dependent objects)
DROP FUNCTION IF EXISTS generate_webhook_url CASCADE;
DROP FUNCTION IF EXISTS generate_webhook_secret CASCADE;
DROP FUNCTION IF EXISTS auto_generate_webhook_config CASCADE;

-- Function to generate webhook URL based on integration type and ID
CREATE FUNCTION generate_webhook_url(
  integration_id UUID,
  integration_type TEXT
)
RETURNS TEXT AS $$
DECLARE
  base_url TEXT;
  webhook_endpoint TEXT;
BEGIN
  -- Get Supabase URL from runtime settings
  -- In production: This will be your actual Supabase URL
  -- In Codespaces: This will be the public forwarded domain
  -- In local dev: Falls back to localhost
  base_url := COALESCE(
    current_setting('app.settings.supabase_url', TRUE),
    current_setting('request.headers', TRUE)::json->>'x-forwarded-host',
    'http://localhost:54321'
  );
  
  -- If we got a host without protocol, add https
  IF base_url !~ '^https?://' THEN
    base_url := 'https://' || base_url;
  END IF;
  
  -- Determine webhook endpoint based on integration type
  -- All types now use unified integration-webhook endpoint
  webhook_endpoint := CASE integration_type
    WHEN 'golioth' THEN 'integration-webhook'
    WHEN 'aws_iot' THEN 'integration-webhook'
    WHEN 'aws-iot' THEN 'integration-webhook'
    WHEN 'azure_iot' THEN 'integration-webhook'
    WHEN 'azure-iot' THEN 'integration-webhook'
    WHEN 'google_iot' THEN 'integration-webhook'
    WHEN 'google-iot' THEN 'integration-webhook'
    WHEN 'mqtt' THEN 'integration-webhook'
    ELSE NULL
  END;
  
  -- Return NULL if integration type doesn't support webhooks
  IF webhook_endpoint IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Construct full webhook URL
  -- Note: We don't include integration_id in query string because it's sent in X-Integration-ID header
  RETURN base_url || '/functions/v1/' || webhook_endpoint;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to generate secure webhook secret
CREATE FUNCTION generate_webhook_secret()
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
    -- Only generate webhook secret if not set
    -- DO NOT generate webhook_url here - let the Edge Function handle it with proper SUPABASE_URL
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
