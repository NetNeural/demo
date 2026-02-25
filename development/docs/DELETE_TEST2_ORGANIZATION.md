# How to Delete test2 Organization

## Quick Fix - Try These Steps in Order:

### Step 1: Verify You're Super Admin
Run in SQL Editor:
```sql
SELECT role FROM users WHERE id = auth.uid();
```
Should show: `super_admin`

If not super admin, you can't delete orgs.

---

### Step 2: Get test2 Organization ID
```sql
SELECT id, name FROM organizations WHERE name = 'test2';
```
Copy the `id` value (looks like: `550e8400-e29b-41d4-a716-446655440000`)

---

### Step 3: Check What's in test2 (What Prevents Deletion)
Replace `YOUR_ORG_ID` below:

```sql
SELECT 
  (SELECT COUNT(*) FROM users WHERE organization_id = 'YOUR_ORG_ID'::uuid) as users,
  (SELECT COUNT(*) FROM devices WHERE organization_id = 'YOUR_ORG_ID'::uuid) as devices,
  (SELECT COUNT(*) FROM locations WHERE organization_id = 'YOUR_ORG_ID'::uuid) as locations,
  (SELECT COUNT(*) FROM device_integrations WHERE organization_id = 'YOUR_ORG_ID'::uuid) as integrations,
  (SELECT COUNT(*) FROM alerts WHERE organization_id = 'YOUR_ORG_ID'::uuid) as alerts;
```

If all zeros → Go to Step 4A  
If any non-zero → Go to Step 4B

---

### Step 4A: Simple Delete (If Empty)
```sql
DELETE FROM organizations WHERE id = 'YOUR_ORG_ID'::uuid;
```

If this fails with "permission denied" → The fix migration hasn't been deployed. See Step 5.

---

### Step 4B: Delete with Data Cleanup (If Has Child Records)

```sql
-- Replace YOUR_ORG_ID with test2's UUID

-- Delete all device data first
DELETE FROM device_data 
WHERE device_id IN (
  SELECT id FROM devices WHERE organization_id = 'YOUR_ORG_ID'::uuid
);

-- Delete everything else
DELETE FROM alerts WHERE organization_id = 'YOUR_ORG_ID'::uuid;
DELETE FROM notifications WHERE organization_id = 'YOUR_ORG_ID'::uuid;
DELETE FROM devices WHERE organization_id = 'YOUR_ORG_ID'::uuid;
DELETE FROM locations WHERE organization_id = 'YOUR_ORG_ID'::uuid;
DELETE FROM device_integrations WHERE organization_id = 'YOUR_ORG_ID'::uuid;
DELETE FROM users WHERE organization_id = 'YOUR_ORG_ID'::uuid;

-- Finally, delete the organization
DELETE FROM organizations WHERE id = 'YOUR_ORG_ID'::uuid;
```

---

### Step 5: If Still Getting "Permission Denied"

The DELETE permission fix needs to be deployed. Run this:

```sql
-- Re-enable DELETE permissions 
GRANT DELETE ON TABLE organizations TO service_role;
GRANT DELETE ON TABLE organizations TO authenticated;

-- Now try deleting again
DELETE FROM organizations WHERE id = 'YOUR_ORG_ID'::uuid;
```

---

## Easiest Method: Use Dashboard

If Supabase Dashboard has an "Delete Organization" button in Settings → Organizations, use that instead. It handles all the cleanup automatically.

---

## Still Not Working?

If you get an error like "permission denied" or "policy violation":

1. **Check user role:**
   ```sql
   SELECT id, email, role, organization_id FROM users WHERE id = auth.uid();
   ```
   Must be `super_admin`

2. **Check if RLS is blocking:**
   ```sql
   SELECT schemaname, tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'organizations';
   ```
   Should show `rowsecurity = true`

3. **Last resort - temporarily disable RLS (not recommended):**
   ```sql
   ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
   DELETE FROM organizations WHERE id = 'YOUR_ORG_ID'::uuid;
   ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
   ```
