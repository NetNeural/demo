-- Manual fix for production: Complete the partially applied migration
-- Run this in Supabase Studio SQL Editor for production

-- STEP 0: Check current state
SELECT 
  u.email,
  u.role,
  u.organization_id as primary_org_id,
  COUNT(om.id) as membership_count,
  STRING_AGG(om.organization_id::text, ', ') as member_orgs
FROM users u
LEFT JOIN organization_members om ON om.user_id = u.id
WHERE u.role = 'super_admin'
GROUP BY u.id, u.email, u.role, u.organization_id;

-- STEP 1: Clean up any orphaned rows from failed migration attempts
DELETE FROM organization_members
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = organization_members.user_id)
   OR NOT EXISTS (SELECT 1 FROM organizations WHERE id = organization_members.organization_id);

-- STEP 2: Ensure all users have membership in their primary org (if they have one)
INSERT INTO organization_members (organization_id, user_id, role, joined_at)
SELECT 
  u.organization_id,
  u.id,
  CASE 
    WHEN u.role = 'super_admin' THEN 'owner'
    WHEN u.role IN ('org_admin', 'org_owner') THEN 'admin'
    ELSE 'member'
  END as role,
  COALESCE(u.created_at, NOW())
FROM users u
WHERE u.organization_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- STEP 3: Add super admin to ALL organizations (one at a time to avoid duplicate IDs)
DO $$
DECLARE
  org_record RECORD;
  user_record RECORD;
BEGIN
  -- For each super admin user
  FOR user_record IN SELECT id FROM users WHERE role = 'super_admin'
  LOOP
    -- For each organization
    FOR org_record IN SELECT id FROM organizations
    LOOP
      -- Insert or update membership
      INSERT INTO organization_members (organization_id, user_id, role, joined_at)
      VALUES (org_record.id, user_record.id, 'owner', NOW())
      ON CONFLICT (organization_id, user_id) DO UPDATE
      SET role = 'owner';
    END LOOP;
  END LOOP;
END $$;

-- STEP 4: Verify the result
SELECT 
  u.email,
  u.role,
  COUNT(om.id) as org_memberships,
  STRING_AGG(o.name, ', ' ORDER BY o.name) as organizations
FROM users u
LEFT JOIN organization_members om ON om.user_id = u.id
LEFT JOIN organizations o ON o.id = om.organization_id
WHERE u.role = 'super_admin'
GROUP BY u.id, u.email, u.role;

-- STEP 5: Mark migration as complete
INSERT INTO supabase_migrations.schema_migrations (version) 
VALUES ('20251111000001')
ON CONFLICT DO NOTHING;
