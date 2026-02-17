-- Fix organization_members infinite recursion (take 2)
-- Date: 2026-02-16
-- Issue: organization_members policy queries users table to check super_admin,
--        but users table policies can trigger organization_members checks, causing recursion

-- Drop the policy that still has circular dependency
DROP POLICY IF EXISTS "Users can view their own organization memberships" ON organization_members;

-- Create truly simple policy with NO subqueries to other tables
-- This prevents ANY possibility of circular dependencies
CREATE POLICY "organization_members_select_user_only" ON organization_members
    FOR SELECT 
    USING (
        -- Service role bypass (checked at JWT level, not database query)
        (auth.jwt() ->> 'role' = 'service_role')
        OR
        -- Users can only view their own memberships
        (user_id = auth.uid())
    );

-- Note: Super admins will need to use service_role or a dedicated function
-- to view all organization memberships, not through RLS
