-- ============================================================================
-- Expand Data Room Guest Access Duration Options
-- ============================================================================
-- Adds 15min (0.25), 30min (0.5), 1hr (1), and 6hr (6) options
-- to the access_duration CHECK constraint on data_room_guests.
-- ============================================================================

-- Drop the old constraint and add the expanded one
ALTER TABLE data_room_guests
  DROP CONSTRAINT IF EXISTS data_room_guests_access_duration_check;

ALTER TABLE data_room_guests
  ADD CONSTRAINT data_room_guests_access_duration_check
    CHECK (access_duration IN ('0.25', '0.5', '1', '6', '24', '48', '72', 'unlimited'));
