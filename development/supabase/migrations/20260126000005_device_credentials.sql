-- Migration: Device Credentials with Encryption (Issue #86)
-- Date: 2026-01-26
-- Description: Encrypted device credentials (PSK, certificates, tokens) with audit logging

-- Enable pgsodium extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Create credentials table with encryption
CREATE TABLE IF NOT EXISTS device_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('PRE_SHARED_KEY', 'CERTIFICATE', 'TOKEN')),
  identity TEXT NOT NULL, -- PSK-ID, cert CN, token name
  encrypted_secret TEXT, -- Encrypted PSK, cert private key, token value
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  last_accessed_by UUID REFERENCES auth.users(id),
  UNIQUE(device_id, credential_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_device_credentials_device 
  ON device_credentials(device_id);

-- Index for expiring credentials (without now() in WHERE clause)
CREATE INDEX IF NOT EXISTS idx_device_credentials_expiring 
  ON device_credentials(expires_at) 
  WHERE expires_at IS NOT NULL;

-- Audit log for credential access
CREATE TABLE IF NOT EXISTS device_credential_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES device_credentials(id) ON DELETE CASCADE,
  accessed_by UUID NOT NULL REFERENCES auth.users(id),
  accessed_at TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_credential_access_log_credential 
  ON device_credential_access_log(credential_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_credential_access_log_user 
  ON device_credential_access_log(accessed_by, accessed_at DESC);

-- Comments
COMMENT ON TABLE device_credentials IS 'Encrypted device credentials (PSK, certificates, tokens) - Issue #86';
COMMENT ON TABLE device_credential_access_log IS 'Audit log for credential access (security compliance)';
