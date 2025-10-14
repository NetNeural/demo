-- Fix organization access for new user registration

-- Add a policy to allow users to see the default organization for auto-assignment
-- This allows new users to be assigned to the default organization
CREATE POLICY "Allow access to default organization for new users" ON organizations
    FOR SELECT USING (slug = 'netneural-demo');

-- Alternatively, we could mark organizations as "public" for registration
-- But for now, we'll just allow access to the specific default org