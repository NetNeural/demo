-- ============================================================================
-- Diagnostic: Find what's preventing test2 organization deletion
-- ============================================================================
-- Run this in Supabase SQL Editor to diagnose deletion issues

-- Step 1: Find the test2 organization
SELECT id, name, created_at 
FROM organizations 
WHERE name ILIKE '%test2%';

-- Copy the ID from above and use it in the queries below

-- ============================================================================
-- Step 2: Check for foreign key constraints preventing deletion
-- ============================================================================

-- Count users in the organization
SELECT COUNT(*) as user_count
FROM users
WHERE organization_id = 'your-org-id-here'::uuid;

-- Count devices in the organization
SELECT COUNT(*) as device_count
FROM devices
WHERE organization_id = 'your-org-id-here'::uuid;

-- Count locations in the organization
SELECT COUNT(*) as location_count
FROM locations
WHERE organization_id = 'your-org-id-here'::uuid;

-- Count device integrations
SELECT COUNT(*) as integration_count
FROM device_integrations
WHERE organization_id = 'your-org-id-here'::uuid;

-- Count device data
SELECT COUNT(*) as device_data_count
FROM device_data
WHERE device_id IN (
  SELECT id FROM devices 
  WHERE organization_id = 'your-org-id-here'::uuid
);

-- Count alerts
SELECT COUNT(*) as alert_count
FROM alerts
WHERE organization_id = 'your-org-id-here'::uuid;

-- Count notifications
SELECT COUNT(*) as notification_count
FROM notifications
WHERE organization_id = 'your-org-id-here'::uuid;

-- ============================================================================
-- Step 3: If there are foreign key references, you have 3 options:
-- ============================================================================

-- OPTION A: Cascade delete everything (careful!)
-- DELETE FROM organizations WHERE id = 'your-org-id-here'::uuid;

-- OPTION B: Delete associated data first, then delete organization
-- DELETE FROM device_data WHERE device_id IN (
--   SELECT id FROM devices WHERE organization_id = 'your-org-id-here'::uuid
-- );
-- DELETE FROM alerts WHERE organization_id = 'your-org-id-here'::uuid;
-- DELETE FROM notifications WHERE organization_id = 'your-org-id-here'::uuid;
-- DELETE FROM devices WHERE organization_id = 'your-org-id-here'::uuid;
-- DELETE FROM locations WHERE organization_id = 'your-org-id-here'::uuid;
-- DELETE FROM device_integrations WHERE organization_id = 'your-org-id-here'::uuid;
-- DELETE FROM users WHERE organization_id = 'your-org-id-here'::uuid;
-- DELETE FROM organizations WHERE id = 'your-org-id-here'::uuid;

-- OPTION C: Disable RLS and delete as service_role
-- (only if you know what you're doing)
-- ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
-- DELETE FROM organizations WHERE id = 'your-org-id-here'::uuid;
-- ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
