-- ============================================================================
-- Data Room Guest Expiry
-- ============================================================================
-- Adds expires_at and access_duration columns to data_room_guests
-- so admins can set 24, 48, 72 hour or unlimited access windows.
-- ============================================================================

-- Add expiry columns
ALTER TABLE data_room_guests
  ADD COLUMN IF NOT EXISTS access_duration TEXT DEFAULT 'unlimited'
    CHECK (access_duration IN ('24', '48', '72', 'unlimited')),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Index for efficient expiry checks
CREATE INDEX IF NOT EXISTS idx_drg_expires
  ON data_room_guests(expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;
