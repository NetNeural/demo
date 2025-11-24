-- Migration: Make webhook URLs dynamic based on current environment
-- Description: Webhook URLs should be generated from configuration, not stored in database
-- Date: 2025-11-24

-- Drop the old trigger that tries to set webhook_url on insert/update
DROP TRIGGER IF EXISTS trigger_auto_generate_webhook_config ON device_integrations;

-- Create a function to get the current Supabase URL from environment
-- This will be called by applications to get the correct webhook URL
CREATE OR REPLACE FUNCTION get_current_supabase_url()
RETURNS TEXT AS $$
BEGIN
  -- This will be overridden by setting app.settings.supabase_url
  -- Applications should set this at runtime based on SUPABASE_URL env var
  RETURN COALESCE(
    current_setting('app.settings.supabase_url', TRUE),
    'http://localhost:54321'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a computed column function that returns the webhook URL for an integration
-- This generates the URL dynamically based on current environment
CREATE OR REPLACE FUNCTION get_webhook_url(integration_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_url TEXT;
BEGIN
  -- Get current Supabase URL (will be set by application)
  base_url := get_current_supabase_url();
  
  -- Return the webhook endpoint URL
  -- All integrations use the unified integration-webhook endpoint
  RETURN base_url || '/functions/v1/integration-webhook';
END;
$$ LANGUAGE plpgsql STABLE;

-- Update the auto_generate_webhook_config trigger to ONLY set webhook_secret
-- Don't set webhook_url anymore since it's computed dynamically
CREATE OR REPLACE FUNCTION auto_generate_webhook_config()
RETURNS TRIGGER AS $$
DECLARE
  needs_webhook BOOLEAN;
BEGIN
  -- Check if integration type supports webhooks
  needs_webhook := NEW.integration_type IN ('golioth', 'aws_iot', 'aws-iot', 'azure_iot', 'azure-iot', 'google_iot', 'google-iot', 'mqtt');
  
  IF needs_webhook THEN
    -- Only generate webhook secret if not set
    -- webhook_url will be computed dynamically via get_webhook_url()
    IF NEW.webhook_secret IS NULL OR NEW.webhook_secret = '' THEN
      NEW.webhook_secret := replace(gen_random_uuid()::TEXT, '-', '') || replace(gen_random_uuid()::TEXT, '-', '');
    END IF;
    
    -- Enable webhooks by default
    IF NEW.webhook_enabled IS NULL THEN
      NEW.webhook_enabled := true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger (now only sets webhook_secret)
CREATE TRIGGER trigger_auto_generate_webhook_config
  BEFORE INSERT OR UPDATE ON device_integrations
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_webhook_config();

-- Add helpful comments
COMMENT ON FUNCTION get_current_supabase_url IS 'Returns the current Supabase URL from runtime configuration';
COMMENT ON FUNCTION get_webhook_url IS 'Dynamically generates webhook URL for an integration based on current environment';
COMMENT ON FUNCTION auto_generate_webhook_config IS 'Trigger function that auto-generates webhook_secret and enables webhooks for IoT integrations. webhook_url is computed dynamically.';

