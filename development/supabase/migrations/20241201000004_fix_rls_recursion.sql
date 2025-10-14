-- Fix infinite recursion in organization_members RLS policies

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Organization admins can manage memberships" ON organization_members;

-- For now, simplify to just allow users to see their own memberships
-- and use service role for admin operations
-- This removes the circular dependency

-- Users can only see their own organization memberships
-- This policy is safe and doesn't cause recursion
CREATE POLICY "Users view own memberships only" ON organization_members
    FOR SELECT USING (auth.uid() = user_id);

-- Allow service role full access for admin operations
CREATE POLICY "Service role full access" ON organization_members
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- For user insertions (when joining organizations), allow if they're the user being added
CREATE POLICY "Users can be added to organizations" ON organization_members
    FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');