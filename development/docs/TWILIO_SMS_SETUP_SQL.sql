-- ============================================================================
-- Twilio SMS Configuration Setup Script
-- ============================================================================
-- Purpose: Configure SMS notifications for alert system via Twilio
-- Usage: Paste this into your SQL editor and execute
-- 
-- IMPORTANT: Replace the placeholder values with your actual Twilio credentials
-- ============================================================================

-- Step 1: IMPORTANT - Replace these THREE values with your actual values:
-- Get from https://console.twilio.com/ → Account → API keys & tokens
-- 
-- A. Your Account SID: starts with "AC" - find at console.twilio.com
-- B. Your Auth Token: find at console.twilio.com (API keys section)
-- C. Your From Number: E.164 format like +15551234567
-- D. Your Org ID: Run this first to find it:
--    SELECT id FROM organizations ORDER BY created_at DESC LIMIT 1;
--
DO $$
DECLARE
  v_twilio_account_sid TEXT := 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';  -- REPLACE THIS: Your Account SID
  v_twilio_auth_token TEXT := 'your_auth_token_here';              -- REPLACE THIS: Your Auth Token
  v_twilio_from_number TEXT := '+1234567890';                      -- REPLACE THIS: Your Twilio Phone Number
  v_organization_id UUID := 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'; -- REPLACE THIS: Your Org ID (from query above)
BEGIN
  
  -- Validate inputs
  IF v_twilio_account_sid = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' THEN
    RAISE NOTICE 'WARNING: Twilio Account SID not set. Using placeholder.';
  END IF;
  
  IF v_twilio_auth_token = 'your_auth_token_here' THEN
    RAISE NOTICE 'WARNING: Twilio Auth Token not set. Using placeholder.';
  END IF;
  
  IF v_twilio_from_number = '+1234567890' THEN
    RAISE NOTICE 'WARNING: Twilio Phone Number not set. Using placeholder.';
  END IF;
  
  -- Step 2: Update organization notification_settings
  -- This stores Twilio credentials in the organization settings JSONB column
  UPDATE organizations
  SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{notification_settings}',
    jsonb_build_object(
      'twilio_account_sid', v_twilio_account_sid,
      'twilio_auth_token', v_twilio_auth_token,
      'twilio_from_number', v_twilio_from_number,
      'sms_enabled', true
    )
  )
  WHERE id = v_organization_id;
  
  RAISE NOTICE 'Organization % updated with Twilio SMS configuration', v_organization_id;
  
END $$;

-- ============================================================================
-- Optional: Verify the configuration was saved correctly
-- ============================================================================
-- Uncomment and run this to verify Twilio settings are in place

/*
SELECT 
  id,
  name,
  settings->'notification_settings' as notification_settings
FROM organizations
WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
*/

-- ============================================================================
-- Optional: View all organizations and their SMS configuration status
-- ============================================================================
-- Uncomment and run this to see SMS status across all organizations

/*
SELECT 
  id,
  name,
  COALESCE(settings->'notification_settings'->>'sms_enabled', 'false') as sms_enabled,
  CASE 
    WHEN settings->'notification_settings'->>'twilio_account_sid' IS NOT NULL THEN 'Configured'
    ELSE 'Not Configured'
  END as twilio_status
FROM organizations
ORDER BY created_at DESC;
*/

-- ============================================================================
-- How to Get Your Twilio Credentials
-- ============================================================================
-- 
-- 1. Go to https://console.twilio.com/
-- 2. Click "Account" in the left menu
-- 3. Go to "API keys & tokens"
-- 4. Copy your Account SID (starts with "AC")
-- 5. Copy your Auth Token (keep this secret!)
-- 6. Go to "Phone Numbers" → "Manage" → "Active numbers"
-- 7. Copy your Twilio phone number in E.164 format (e.g., +1234567890)
--
-- SECURITY: Never commit these credentials to version control.
-- Use environment variables or GitHub Secrets for production.
-- ============================================================================

-- ============================================================================
-- Optional: Reset/Clear Twilio Configuration
-- ============================================================================
-- If you need to remove Twilio configuration from an organization:

/*
UPDATE organizations
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{notification_settings}',
  '{}'::jsonb
)
WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
*/

-- ============================================================================
-- Optional: Configure Slack Webhook (in same notification_settings)
-- ============================================================================
-- You can also add Slack configuration in the same update:

/*
DO $$
DECLARE
  v_slack_webhook_url TEXT := 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL';
  v_organization_id UUID := 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
BEGIN
  
  UPDATE organizations
  SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{notification_settings}',
    jsonb_build_object(
      'twilio_account_sid', settings->'notification_settings'->>'twilio_account_sid',
      'twilio_auth_token', settings->'notification_settings'->>'twilio_auth_token',
      'twilio_from_number', settings->'notification_settings'->>'twilio_from_number',
      'slack_webhook_url', v_slack_webhook_url,
      'sms_enabled', true
    )
  )
  WHERE id = v_organization_id;
  
END $$;
*/

-- ============================================================================
-- Testing: Send Test Alert with SMS
-- ============================================================================
-- After configuration, test SMS delivery by:
-- 
-- 1. Go to Dashboard → Device Details → Sensor Threshold
-- 2. Enable SMS notification channel
-- 3. Enter phone numbers in E.164 format (e.g., +15551234567)
-- 4. Click "Test Alert" to trigger a test notification
-- 
-- For trial Twilio accounts: phone numbers must be verified
-- in your Twilio Console first.
-- ============================================================================
