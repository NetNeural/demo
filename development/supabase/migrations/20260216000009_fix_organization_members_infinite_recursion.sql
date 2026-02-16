-- Fix organization_members infinite recursion in RLS policy
-- Date: 2026-02-16
-- Issue: Policy queries organization_members within itself, causing infinite recursion
-- Error: "infinite recursion detected in policy for relation 'organization_members'"

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view members in their organizations" ON organization_members;

-- Create simplified policy without circular dependency
-- Users can view their own memberships and super admins can view all
CREATE POLICY "Users can view their own organization memberships" ON organization_members
    FOR SELECT 
    USING (
        -- Service role has full access
        auth.jwt() ->> 'role' = 'service_role'
        OR
        -- Users can view their own memberships
        user_id = auth.uid()
        OR
        -- Super admins can see all memberships
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'super_admin'
        )
    );

-- Note: This policy allows users to see only their own organization memberships.
-- For viewing other members in the same organization, use a separate view or function
-- that doesn't trigger recursive policy checks.
