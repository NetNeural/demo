-- Migration: Fix webhook URLs to use proper public Supabase URL
-- Description: Update all webhook URLs from localhost to use environment-specific URL
-- Date: 2025-11-24

-- This migration is intentionally empty for the database
-- The webhook URLs will be set by the Edge Function using SUPABASE_URL env var
-- This ensures the URL is always correct for the current environment

-- Mark existing integrations to be updated by adding a comment
COMMENT ON TABLE device_integrations IS 'Webhook URLs are now managed by Edge Functions to ensure correct public URL';

-- Note: To fix existing integrations, they need to be updated via the Edge Function
-- which has access to the proper SUPABASE_URL environment variable
