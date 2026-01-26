-- Migration: Firmware Artifacts Catalog (Issue #85)
-- Date: 2026-01-26
-- Description: Catalog of available firmware artifacts from IoT platforms

CREATE TABLE IF NOT EXISTS firmware_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES device_integrations(id) ON DELETE CASCADE,
  external_artifact_id TEXT NOT NULL, -- Golioth artifact ID
  package_name TEXT NOT NULL,
  version TEXT NOT NULL,
  component_type TEXT, -- 'main', 'cellgateway', 'modsensor'
  size_bytes BIGINT,
  checksum_sha256 TEXT,
  release_date TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(integration_id, external_artifact_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_firmware_artifacts_org 
  ON firmware_artifacts(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_firmware_artifacts_integration 
  ON firmware_artifacts(integration_id, package_name, version);

CREATE INDEX IF NOT EXISTS idx_firmware_artifacts_version 
  ON firmware_artifacts(package_name, version);

-- Comment
COMMENT ON TABLE firmware_artifacts IS 'Catalog of available firmware artifacts from IoT platforms (Issue #85)';
