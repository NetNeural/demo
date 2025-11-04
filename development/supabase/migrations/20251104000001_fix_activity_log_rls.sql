-- ============================================================================
-- FIX ACTIVITY LOG RLS POLICY
-- ============================================================================
-- Update RLS policy to allow users to view activity logs for their organization
-- even if they don't have an organization_members record
-- ============================================================================

BEGIN;

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "org_members_view_integration_activity" ON integration_activity_log;

-- Create a new policy that allows viewing logs for organizations the user has access to
-- This allows users who are organization members OR system admins
CREATE POLICY "users_view_integration_activity" ON integration_activity_log
    FOR SELECT USING (
        organization_id IN (
            -- Check if user is in organization_members
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
        OR
        -- Also allow super_admin and org_owner roles (check users table)
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'org_owner')
            AND (organization_id = integration_activity_log.organization_id OR role = 'super_admin')
        )
    );COMMIT;
