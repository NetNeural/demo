-- Fix infinite recursion by removing the problematic self-referential policy

-- Drop all the complex policies that cause recursion
DROP POLICY IF EXISTS "Users can view their own organization memberships" ON organization_members;
DROP POLICY IF EXISTS "Admins can update organization memberships" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete organization memberships" ON organization_members;

-- The simple policies from the recursion fix should remain and work:
-- "Users view own memberships only" FOR SELECT USING (auth.uid() = user_id)
-- "Service role full access" 
-- "Users can be added to organizations" FOR INSERT

-- Verify the simple SELECT policy exists, if not create it
-- We use IF NOT EXISTS equivalent by dropping and recreating
DROP POLICY IF EXISTS "Users view own memberships only" ON organization_members;
CREATE POLICY "Users view own memberships only" ON organization_members
    FOR SELECT USING (auth.uid() = user_id);

-- Ensure users can insert their own memberships
DROP POLICY IF EXISTS "Users can be added to organizations" ON organization_members;
CREATE POLICY "Users can be added to organizations" ON organization_members
    FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

-- Service role should have full access  
DROP POLICY IF EXISTS "Service role full access" ON organization_members;
CREATE POLICY "Service role full access" ON organization_members
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');