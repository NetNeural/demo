-- ============================================================================
-- Migration: Force PostgREST Schema Cache Reload + Ensure access_requests FK
-- ============================================================================
-- After FK constraints on access_requests were changed (from auth.users to
-- public.users), PostgREST may have cached the old schema. This migration
-- forces a reload and ensures all columns/constraints are correct.
-- ============================================================================

-- 1. Ensure all required columns exist on access_requests (idempotent)
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS denied_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS denied_at TIMESTAMPTZ;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS denial_reason TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS granted_membership_id UUID;

-- 2. Ensure FK constraints point to public.users (idempotent re-run of fix)
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

-- 3. Ensure organization FKs exist (in case they were lost)
ALTER TABLE access_requests DROP CONSTRAINT IF EXISTS access_requests_requester_org_id_fkey;
ALTER TABLE access_requests DROP CONSTRAINT IF EXISTS access_requests_target_org_id_fkey;

ALTER TABLE access_requests
  ADD CONSTRAINT access_requests_requester_org_id_fkey
  FOREIGN KEY (requester_org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE access_requests
  ADD CONSTRAINT access_requests_target_org_id_fkey
  FOREIGN KEY (target_org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 4. Ensure organization_members has the temporary access columns
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT false;

-- 5. Force PostgREST to reload its schema cache so new FK joins are recognized
NOTIFY pgrst, 'reload schema';
