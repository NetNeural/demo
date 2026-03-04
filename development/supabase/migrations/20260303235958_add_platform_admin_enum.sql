-- Migration: Add platform_admin enum value to user_role
-- This must be in its own migration because ALTER TYPE ADD VALUE
-- cannot be used with other statements in the same transaction
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'platform_admin' AFTER 'super_admin';
