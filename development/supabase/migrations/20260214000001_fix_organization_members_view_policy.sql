-- Fix organization_members RLS to allow viewing all members in user's organizations
-- Date: 2026-02-14
-- Issue: Member count showing 1 instead of actual count because users can only see their own membership

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Users view own memberships only" ON organization_members;

-- Create new policy: Users can view all members of organizations they belong to
CREATE POLICY "Users can view members in their organizations" ON organization_members
    FOR SELECT 
    USING (
        -- Service role has full access
        auth.jwt() ->> 'role' = 'service_role'
        OR
        -- Super admins can see all
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'super_admin'
        )
        OR
        -- Regular users can see members of their own organizations
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

-- Keep other policies unchanged
-- "Users can be added to organizations" - FOR INSERT
-- "Service role full access" - FOR ALL
