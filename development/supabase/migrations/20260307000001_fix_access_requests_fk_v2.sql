-- =============================================================================
-- Migration: Re-verify access_requests FK constraints + force PostgREST reload
-- =============================================================================
-- Idempotent fix to ensure all 5 FK constraint names that the request-access
-- edge function references via ! syntax are present and point to public schema.
--
-- Constraints the function needs:
--   access_requests_requester_id_fkey       → public.users(id)
--   access_requests_approved_by_fkey        → public.users(id)
--   access_requests_denied_by_fkey          → public.users(id)
--   access_requests_requester_org_id_fkey   → public.organizations(id)
--   access_requests_target_org_id_fkey      → public.organizations(id)
-- =============================================================================

-- Ensure all columns exist (idempotent)
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS approved_by           UUID;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS approved_at           TIMESTAMPTZ;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS denied_by             UUID;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS denied_at             TIMESTAMPTZ;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS denial_reason         TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS expires_at            TIMESTAMPTZ;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS granted_membership_id UUID;

-- ── User FKs (drop then re-add pointing to public.users) ─────────────────────
ALTER TABLE access_requests DROP CONSTRAINT IF EXISTS access_requests_requester_id_fkey;
ALTER TABLE access_requests DROP CONSTRAINT IF EXISTS access_requests_approved_by_fkey;
ALTER TABLE access_requests DROP CONSTRAINT IF EXISTS access_requests_denied_by_fkey;

ALTER TABLE access_requests
  ADD CONSTRAINT access_requests_requester_id_fkey
  FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE access_requests
  ADD CONSTRAINT access_requests_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE access_requests
  ADD CONSTRAINT access_requests_denied_by_fkey
  FOREIGN KEY (denied_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- ── Org FKs (drop then re-add to ensure explicit names exist) ─────────────────
ALTER TABLE access_requests DROP CONSTRAINT IF EXISTS access_requests_requester_org_id_fkey;
ALTER TABLE access_requests DROP CONSTRAINT IF EXISTS access_requests_target_org_id_fkey;

ALTER TABLE access_requests
  ADD CONSTRAINT access_requests_requester_org_id_fkey
  FOREIGN KEY (requester_org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE access_requests
  ADD CONSTRAINT access_requests_target_org_id_fkey
  FOREIGN KEY (target_org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ── Force PostgREST to reload its schema cache ────────────────────────────────
NOTIFY pgrst, 'reload schema';
