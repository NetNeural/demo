-- Migration: 20260220100000_add_user_phone_numbers.sql
-- Add phone number fields to users table for contact information and SMS notifications
-- Supports primary and secondary phone numbers with SMS opt-in preferences

-- Add phone number columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS phone_number_secondary VARCHAR(20),
ADD COLUMN IF NOT EXISTS phone_sms_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_secondary_sms_enabled BOOLEAN DEFAULT false;

-- Add indexes for querying users by phone numbers
CREATE INDEX IF NOT EXISTS idx_users_phone_number
    ON users (phone_number)
    WHERE phone_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_phone_secondary
    ON users (phone_number_secondary)
    WHERE phone_number_secondary IS NOT NULL;

-- Add index for finding users with SMS enabled
CREATE INDEX IF NOT EXISTS idx_users_sms_enabled
    ON users (phone_sms_enabled)
    WHERE phone_sms_enabled = true AND phone_number IS NOT NULL;

-- Add comments
COMMENT ON COLUMN users.phone_number IS
    'Primary phone number (E.164 format preferred, e.g. +15551234567)';

COMMENT ON COLUMN users.phone_number_secondary IS
    'Secondary phone number (E.164 format preferred, e.g. +15551234567)';

COMMENT ON COLUMN users.phone_sms_enabled IS
    'Whether user has opted in to receive SMS messages on primary phone number';

COMMENT ON COLUMN users.phone_secondary_sms_enabled IS
    'Whether user has opted in to receive SMS messages on secondary phone number';

-- Add validation function for E.164 phone format
CREATE OR REPLACE FUNCTION validate_phone_format()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate primary phone number format if provided
    IF NEW.phone_number IS NOT NULL THEN
        -- Remove spaces, dashes, parentheses for validation
        IF NOT regexp_replace(NEW.phone_number, '[\s\-\(\)]', '', 'g') ~ '^\+?[1-9]\d{1,14}$' THEN
            RAISE EXCEPTION 'Invalid phone number format. Use E.164 format (e.g., +15551234567) or local format.';
        END IF;
    END IF;

    -- Validate secondary phone number format if provided
    IF NEW.phone_number_secondary IS NOT NULL THEN
        IF NOT regexp_replace(NEW.phone_number_secondary, '[\s\-\(\)]', '', 'g') ~ '^\+?[1-9]\d{1,14}$' THEN
            RAISE EXCEPTION 'Invalid secondary phone number format. Use E.164 format (e.g., +15551234567) or local format.';
        END IF;
    END IF;

    -- Disable SMS if phone number is removed
    IF NEW.phone_number IS NULL THEN
        NEW.phone_sms_enabled := false;
    END IF;

    IF NEW.phone_number_secondary IS NULL THEN
        NEW.phone_secondary_sms_enabled := false;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for phone validation
DROP TRIGGER IF EXISTS validate_phone_numbers ON users;
CREATE TRIGGER validate_phone_numbers
    BEFORE INSERT OR UPDATE OF phone_number, phone_number_secondary, phone_sms_enabled, phone_secondary_sms_enabled
    ON users
    FOR EACH ROW
    EXECUTE FUNCTION validate_phone_format();

-- Grant necessary permissions
GRANT SELECT, UPDATE ON users TO authenticated;
