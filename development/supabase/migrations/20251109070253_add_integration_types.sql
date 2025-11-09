-- Migration: Add support for additional integration types
-- Date: 2025-11-09
-- Description: Extends device_integrations table constraint to support MQTT, SMTP, Slack, and Webhook integration types
-- Fixes: GitHub Issue #76 - MQTT integration not saving

-- Drop existing constraint that only allowed 4 integration types
ALTER TABLE device_integrations 
DROP CONSTRAINT IF EXISTS device_integrations_integration_type_check;

-- Add updated constraint with additional integration types
ALTER TABLE device_integrations 
ADD CONSTRAINT device_integrations_integration_type_check 
CHECK (integration_type::text = ANY (ARRAY[
  'golioth'::character varying::text,
  'aws_iot'::character varying::text,
  'azure_iot'::character varying::text,
  'google_iot'::character varying::text,
  'mqtt'::character varying::text,
  'smtp'::character varying::text,
  'slack'::character varying::text,
  'webhook'::character varying::text
]));

-- Migration Notes:
-- This migration was necessary because the UI offered 8 integration types but
-- the database constraint only allowed 4 types ('golioth', 'aws_iot', 'azure_iot', 'google_iot').
-- When users tried to save MQTT, SMTP, Slack, or Webhook integrations, they received
-- PostgreSQL error 23514: "violates check constraint device_integrations_integration_type_check"
--
-- The fix adds the missing integration types to the constraint while preserving the original types.
-- No data migration is needed as no existing records violate the new constraint.
