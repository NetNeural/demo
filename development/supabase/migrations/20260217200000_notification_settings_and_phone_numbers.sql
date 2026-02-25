-- Migration: 20260217200000_notification_settings_and_phone_numbers.sql
-- Add SMS phone numbers to sensor_thresholds for per-threshold SMS recipients
-- Organization notification_settings stored in existing organizations.settings JSONB
--
-- organizations.settings will include:
--   {
--     "notification_settings": {
--       "slack_webhook_url": "https://hooks.slack.com/services/...",
--       "slack_channel": "#alerts",
--       "slack_enabled": true,
--       "twilio_account_sid": "AC...",
--       "twilio_auth_token": "...",
--       "twilio_from_number": "+1...",
--       "sms_enabled": true,
--       "email_enabled": true,
--       "default_email_address": "admin@company.com"
--     }
--   }

-- Add phone numbers column to sensor_thresholds for per-threshold SMS recipients
ALTER TABLE sensor_thresholds
ADD COLUMN IF NOT EXISTS notify_phone_numbers TEXT[] DEFAULT '{}';

-- Add index for querying thresholds with phone numbers
CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_notify_phones
    ON sensor_thresholds USING GIN (notify_phone_numbers)
    WHERE notify_phone_numbers IS NOT NULL AND array_length(notify_phone_numbers, 1) > 0;

-- Add comment
COMMENT ON COLUMN sensor_thresholds.notify_phone_numbers IS
    'Array of phone numbers (E.164 format, e.g. +15551234567) to notify via SMS when threshold is breached';

-- Update notification_channels comment to reflect full support
COMMENT ON COLUMN sensor_thresholds.notification_channels IS
    'Array of notification channels to use: email (via Resend), slack (via org webhook), sms (via Twilio)';
