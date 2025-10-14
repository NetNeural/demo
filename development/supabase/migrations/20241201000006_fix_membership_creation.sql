-- Fix organization membership creation for new user registration

-- Drop the current restrictive INSERT policy
DROP POLICY IF EXISTS "Users can be added to organizations" ON organization_members;

-- Create a more permissive policy that allows new user registration
-- Allow users to be added to the default organization during registration
CREATE POLICY "Allow new user registration to default org" ON organization_members
    FOR INSERT WITH CHECK (
        -- Allow if the user being added is the authenticated user
        auth.uid() = user_id
        OR 
        -- Allow service role operations
        auth.jwt() ->> 'role' = 'service_role'
        OR
        -- Allow adding users to the default organization specifically
        organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    );