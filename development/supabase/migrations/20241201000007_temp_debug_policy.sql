-- Temporarily create a very permissive policy for debugging

-- Drop current policy
DROP POLICY IF EXISTS "Allow new user registration to default org" ON organization_members;

-- Create a temporary permissive policy for debugging
CREATE POLICY "Temp permissive for debugging" ON organization_members
    FOR INSERT WITH CHECK (true);