-- Add super admin user to Tes Org through organization_members table
-- This allows multi-organization access while keeping NetNeural as primary org

-- Insert membership record (if it doesn't already exist)
INSERT INTO organization_members (organization_id, user_id, role, joined_at)
VALUES (
  '11ec1e5c-a9df-4313-8ca3-15675f35f673',  -- Tes Org
  'd17ea1bd-a26f-44fa-93fb-fd2fbffeb9b0',  -- kaidream78@gmail.com
  'owner',                                   -- Give owner role
  NOW()
)
ON CONFLICT (organization_id, user_id) DO UPDATE
SET role = 'owner';  -- Update role if membership already exists

-- Verify the memberships
SELECT 
  om.organization_id,
  o.name as org_name,
  om.role,
  om.joined_at
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
WHERE om.user_id = 'd17ea1bd-a26f-44fa-93fb-fd2fbffeb9b0'
ORDER BY om.joined_at;
