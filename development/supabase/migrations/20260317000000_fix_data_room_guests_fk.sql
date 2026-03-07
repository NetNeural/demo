-- ============================================================================
-- Fix data_room_guests foreign keys for PostgREST joins
-- ============================================================================
-- Problem: invited_by and revoked_by reference auth.users(id), but PostgREST
-- cannot follow FK relationships into the auth schema from the API.
-- The UI query `inviter:invited_by(full_name, email)` fails with 400
-- because PostgREST can't resolve the join.
--
-- Fix: Point these FKs at public.users(id) instead, which has the same
-- id values and exposes full_name + email for the join.
-- ============================================================================

-- Drop existing FKs to auth.users
ALTER TABLE data_room_guests
  DROP CONSTRAINT IF EXISTS data_room_guests_invited_by_fkey;

ALTER TABLE data_room_guests
  DROP CONSTRAINT IF EXISTS data_room_guests_revoked_by_fkey;

-- Add FKs to public.users (which PostgREST can follow)
ALTER TABLE data_room_guests
  ADD CONSTRAINT data_room_guests_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES users(id);

ALTER TABLE data_room_guests
  ADD CONSTRAINT data_room_guests_revoked_by_fkey
  FOREIGN KEY (revoked_by) REFERENCES users(id);
