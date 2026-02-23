-- ============================================================================
-- Step 1: Find Your Organization ID
-- ============================================================================
-- Run this first to get your actual organization UUID
-- Copy the ID value and use it in the Twilio setup script

SELECT id, name, created_at
FROM organizations
ORDER BY created_at DESC
LIMIT 10;

-- You should see something like:
-- | id                                   | name               |
-- |--------------------------------------|-------------------|
-- | 550e8400-e29b-41d4-a716-446655440000 | Your Org Name     |
--
-- Copy that UUID (the id column value)
