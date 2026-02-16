-- Migration: 20260216000004_add_threshold_notification_recipients.sql
-- Add notification recipient fields to sensor_thresholds table
-- Supports both user selection and manual email addresses

-- Add columns for notification recipients
ALTER TABLE sensor_thresholds
ADD COLUMN IF NOT EXISTS notify_user_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notify_emails TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notification_channels TEXT[] DEFAULT '{}';

-- Add indexes for querying
CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_notify_user_ids 
    ON sensor_thresholds USING GIN (notify_user_ids)
    WHERE notify_user_ids IS NOT NULL AND array_length(notify_user_ids, 1) > 0;

-- Add comments
COMMENT ON COLUMN sensor_thresholds.notify_user_ids IS 
    'Array of user IDs to notify when threshold is breached (references users table)';

COMMENT ON COLUMN sensor_thresholds.notify_emails IS 
    'Array of manual email addresses to notify (for external contacts)';

COMMENT ON COLUMN sensor_thresholds.notification_channels IS 
    'Array of notification channels to use: email, slack, sms (currently only email via Resend)';
