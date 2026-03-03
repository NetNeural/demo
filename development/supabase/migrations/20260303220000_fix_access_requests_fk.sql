-- =============================================================================
-- Migration: Fix access_requests FK constraints for PostgREST join support
-- =============================================================================
-- Problem: access_requests has FK constraints pointing to auth.users(id), but
-- PostgREST can only discover relationship joins for tables in the public schema.
-- The GET handler uses joins like `requester:users!requester_id(...)` which fail
-- with HTTP 500 because PostgREST cannot find the auth.users relationship.
--
-- Fix:
--   1. Create access_requests table if it doesn't exist (with correct FKs)
--   2. If it already exists, drop old auth.users FKs and add public.users FKs
--
-- public.users.id is a PK that references auth.users(id) ON DELETE CASCADE,
-- so referential integrity is preserved through the chain.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'access_requests'
  ) THEN
    -- ── Create table with correct public.users FK constraints from the start ──
    CREATE TABLE access_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      requester_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      target_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      requested_duration INTERVAL NOT NULL DEFAULT '4 hours',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'revoked')),
      approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ,
      denied_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
      denied_at TIMESTAMPTZ,
      denial_reason TEXT,
      expires_at TIMESTAMPTZ,
      granted_membership_id UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Indexes
    CREATE INDEX idx_access_requests_requester ON access_requests(requester_id);
    CREATE INDEX idx_access_requests_target_org ON access_requests(target_org_id);
    CREATE INDEX idx_access_requests_status ON access_requests(status);
    CREATE INDEX idx_access_requests_expires ON access_requests(expires_at) WHERE status = 'approved';
    CREATE INDEX idx_access_requests_pending ON access_requests(target_org_id, status) WHERE status = 'pending';

    -- organization_members columns (if not present from original migration)
    ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT false;
    CREATE INDEX IF NOT EXISTS idx_org_members_expires
      ON organization_members(expires_at) WHERE expires_at IS NOT NULL;

    -- RLS
    ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Super admins can manage all access requests" ON access_requests;
    CREATE POLICY "Super admins can manage all access requests"
      ON access_requests FOR ALL
      USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

    DROP POLICY IF EXISTS "Users can view their own access requests" ON access_requests;
    CREATE POLICY "Users can view their own access requests"
      ON access_requests FOR SELECT USING (requester_id = auth.uid());

    DROP POLICY IF EXISTS "Org owners can view requests for their org" ON access_requests;
    CREATE POLICY "Org owners can view requests for their org"
      ON access_requests FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.organization_id = access_requests.target_org_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
      );

    -- Cleanup function
    CREATE OR REPLACE FUNCTION cleanup_expired_access()
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $fn$
    BEGIN
      UPDATE access_requests SET status = 'expired', updated_at = now()
      WHERE status = 'approved' AND expires_at < now();
      DELETE FROM organization_members
      WHERE is_temporary = true AND expires_at IS NOT NULL AND expires_at < now();
    END;
    $fn$;

    -- Updated-at trigger
    CREATE OR REPLACE FUNCTION update_access_requests_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $fn$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_access_requests_updated_at ON access_requests;
    CREATE TRIGGER trigger_access_requests_updated_at
      BEFORE UPDATE ON access_requests
      FOR EACH ROW EXECUTE FUNCTION update_access_requests_updated_at();

  ELSE
    -- ── Table already exists: fix FK constraints to point to public.users ──
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

  END IF;
END $$;
