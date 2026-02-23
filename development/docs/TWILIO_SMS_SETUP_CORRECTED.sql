-- ============================================================================
-- Twilio SMS Setup - CORRECTED VERSION
-- ============================================================================
--
-- STEP 1: First, run this query to find your Organization ID:
-- ============================================================================

SELECT 
  id as organization_id,
  name as organization_name,
  created_at
FROM organizations
ORDER BY created_at DESC
LIMIT 5;

-- Copy the ID value from the first row (most recent organization)
-- It will look like: 550e8400-e29b-41d4-a716-446655440000

-- ============================================================================
-- STEP 2: Get your Twilio credentials from https://console.twilio.com/
-- ============================================================================
--
-- A) Account SID: 
--    Log in → Click "Account" menu → Copy "Account SID" (starts with "AC")
--
-- B) Auth Token:
--    Log in → Click "Account" menu → "API keys & tokens" → Copy "Auth Token"
--
-- C) Twilio Phone Number:
--    Log in → "Phone Numbers" → "Manage" → Find your number
--    Copy it in format like: +15551234567 (E.164 format with +)
--
-- ============================================================================
-- STEP 3: Replace placeholders below and run:
-- ============================================================================

DO $$
DECLARE
  -- REPLACE THESE THREE VALUES:
  v_twilio_account_sid TEXT := 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';  -- Your Account SID from Twilio
  v_twilio_auth_token TEXT := 'your_auth_token_here';              -- Your Auth Token from Twilio
  v_twilio_from_number TEXT := '+1234567890';                      -- Your Twilio Phone Number (with +)
  -- REPLACE THIS WITH YOUR ORGANIZATION ID (from Step 1 above):
  v_organization_id UUID := '550e8400-e29b-41d4-a716-446655440000'; -- Your actual org ID

BEGIN
  
  -- Validate that you replaced the placeholders
  IF v_twilio_account_sid = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' THEN
    RAISE EXCEPTION 'ERROR: Replace v_twilio_account_sid with your actual Twilio Account SID';
  END IF;
  
  IF v_twilio_auth_token = 'your_auth_token_here' THEN
    RAISE EXCEPTION 'ERROR: Replace v_twilio_auth_token with your actual Twilio Auth Token';
  END IF;
  
  IF v_twilio_from_number = '+1234567890' THEN
    RAISE EXCEPTION 'ERROR: Replace v_twilio_from_number with your actual Twilio phone number';
  END IF;
  
  IF v_organization_id = '550e8400-e29b-41d4-a716-446655440000' THEN
    RAISE EXCEPTION 'ERROR: Replace v_organization_id with your actual organization ID (from Step 1)';
  END IF;
  
  -- Update the organization with Twilio SMS configuration
  -- This stores credentials in the settings JSONB column
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
  
  -- Verify the update worked
  IF FOUND THEN
    RAISE NOTICE 'SUCCESS: Organization % updated with Twilio SMS configuration', v_organization_id;
  ELSE
    RAISE EXCEPTION 'ERROR: Organization ID % not found in database', v_organization_id;
  END IF;
  
END $$;

-- ============================================================================
-- STEP 4: Verify the configuration was saved
-- ============================================================================
-- Uncomment and run this to confirm Twilio settings are saved:

/*
SELECT 
  id,
  name,
  settings->'notification_settings' as twilio_config
FROM organizations
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
*/

-- You should see output like:
-- id                   | name        | twilio_config
-- ────────────────────┼─────────────┼───────────────────────────────────────
-- 550e8400-e29b-41d4..| Your Org    | {"twilio_account_sid": "AC...", ...}
