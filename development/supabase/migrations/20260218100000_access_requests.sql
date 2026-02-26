-- ============================================================================
-- Migration: Cross-Org Temporary Access Request System (Issue #35)
-- ============================================================================
-- Creates the access_requests table and adds expires_at to organization_members
-- Enables time-limited cross-org access with full audit trail
-- ============================================================================

-- 1. Create access_requests table
CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  target_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  requested_duration INTERVAL NOT NULL DEFAULT '4 hours',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'revoked')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  denied_by UUID REFERENCES auth.users(id),
  denied_at TIMESTAMPTZ,
  denial_reason TEXT,
  expires_at TIMESTAMPTZ,
  granted_membership_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_access_requests_requester ON access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_target_org ON access_requests(target_org_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_expires ON access_requests(expires_at) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_access_requests_pending ON access_requests(target_org_id, status) WHERE status = 'pending';

-- 2. Add expires_at column to organization_members for temporary memberships
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Index for finding expired memberships
CREATE INDEX IF NOT EXISTS idx_org_members_expires
  ON organization_members(expires_at)
  WHERE expires_at IS NOT NULL;

-- 3. Add is_temporary flag to distinguish temp access from permanent members
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT false;

-- 4. RLS policies for access_requests
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

-- Super admins can see all requests
DROP POLICY IF EXISTS "Super admins can manage all access requests" ON access_requests;
CREATE POLICY "Super admins can manage all access requests"
  ON access_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Requesters can see their own requests
DROP POLICY IF EXISTS "Users can view their own access requests" ON access_requests;
CREATE POLICY "Users can view their own access requests"
  ON access_requests
  FOR SELECT
  USING (requester_id = auth.uid());

-- Org owners/admins can see requests targeting their org
DROP POLICY IF EXISTS "Org owners can view requests for their org" ON access_requests;
CREATE POLICY "Org owners can view requests for their org"
  ON access_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = access_requests.target_org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- 5. Function to auto-expire approved requests and clean up temp memberships
CREATE OR REPLACE FUNCTION cleanup_expired_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark expired approved requests
  UPDATE access_requests
  SET status = 'expired', updated_at = now()
  WHERE status = 'approved'
    AND expires_at < now();

  -- Remove expired temporary memberships
  DELETE FROM organization_members
  WHERE is_temporary = true
    AND expires_at IS NOT NULL
    AND expires_at < now();
END;
$$;

-- 6. Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_access_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_access_requests_updated_at ON access_requests;
CREATE TRIGGER trigger_access_requests_updated_at
  BEFORE UPDATE ON access_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_access_requests_updated_at();

-- 7. Schedule cleanup (runs via pg_cron if available, or called via edge function)
-- Note: pg_cron setup depends on Supabase plan
-- SELECT cron.schedule('cleanup-expired-access', '*/15 * * * *', 'SELECT cleanup_expired_access()');

COMMENT ON TABLE access_requests IS 'Cross-org temporary access requests (Issue #35)';
COMMENT ON COLUMN access_requests.requested_duration IS 'Requested access duration as PostgreSQL interval';
COMMENT ON COLUMN access_requests.granted_membership_id IS 'The organization_members row created on approval';
COMMENT ON COLUMN organization_members.expires_at IS 'When temporary membership expires (NULL = permanent)';
COMMENT ON COLUMN organization_members.is_temporary IS 'Whether this is a temporary cross-org access grant';
