-- Migration: Sync Conflict Detection (Issue #87)
-- Date: 2026-01-26
-- Description: Tracks conflicts between local and remote device data for manual resolution

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  local_value JSONB,
  remote_value JSONB,
  conflict_detected_at TIMESTAMPTZ DEFAULT now(),
  resolution_strategy TEXT CHECK (resolution_strategy IN ('prefer_local', 'prefer_remote', 'manual', 'merge')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_unresolved 
  ON sync_conflicts(device_id, conflict_detected_at DESC) 
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_device 
  ON sync_conflicts(device_id, conflict_detected_at DESC);

-- Comment
COMMENT ON TABLE sync_conflicts IS 'Detected conflicts between local and remote device data (Issue #87)';
