# Super Admin Permission Debugging Checklist

## The Problem
Delete button is grayed out for test2 organization, but you're logged in as super_admin.

## Root Causes (in order of likelihood)

### Check 1: Your User Role in Database
**Run this SQL in Supabase Editor:**
```sql
SELECT id, email, role, organization_id FROM users WHERE id = auth.uid();
```

**Expected:** role = `super_admin`

**If Wrong:** Fix it:
```sql
UPDATE users SET role = 'super_admin' WHERE id = auth.uid();
```

**Then:** Log out and back in to refresh your JWT token ⚠️

---

### Check 2: Organization Hierarchy
**Understanding NetNeural's structure:**
```sql
SELECT id, name, parent_organization_id FROM organizations;
```

**Output should look like:**
```
id                | name        | parent_org_id
──────────────────┼─────────────┼──────────────
netneural-uuid    | NetNeural   | NULL (is parent)
test2-uuid        | test2       | netneural-uuid (child of NetNeural)
```

- NetNeural has `parent_organization_id = NULL` (it's the root)
- test2 has `parent_organization_id = NetNeural's ID` (it's a child)
- As super_admin, you can manage both parent and all children

---

### Check 3: Database Permissions (Row-Level Security)
RLS blocks might prevent deletion even with correct role.

**Check if DELETE is granted:**
```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'organizations';
```

**Should show:** `rowsecurity = true`

**If RLS is blocking DELETE, run:**
```sql
GRANT DELETE ON TABLE organizations TO service_role;
GRANT DELETE ON TABLE organizations TO authenticated;
```

---

### Check 4: Frontend State
**In browser console, run:**
```javascript
// Check your user object
JSON.stringify(JSON.parse(localStorage.getItem('user') || '{}'), null, 2)
```

**Should show:**
```json
{
  "role": "super_admin",
  "isSuperAdmin": true
}
```

---

### Check 5: Edge Function Authorization
**The Edge Function checks:**
1. Is request authenticated? (Bearer token in Authorization header)
2. Is user role = "super_admin"?
3. If yes, allow DELETE without further checks

**If DELETE fails with "permission denied" from Edge Function:**
- Check Supabase Dashboard → Functions → organizations → Logs
- Look for error message indicating what failed

---

## Complete Fix (Do This in Order)

### Step 1: Verify Your Role
```sql
SELECT role FROM users WHERE id = auth.uid();
-- If NOT super_admin, fix it:
UPDATE users SET role = 'super_admin' WHERE id = auth.uid();
```

### Step 2: Re-authenticate
1. Log out from dashboard (top right menu → Sign Out)
2. Clear browser cache (Ctrl+Shift+Delete)
3. Log back in
4. Wait for JWT token to refresh (should be automatic)

### Step 3: Verify Changes Took Effect
In browser console:
```javascript
// Should show super_admin role
const user = JSON.parse(localStorage.getItem('user') || 'null')
console.log('User role:', user?.role)
```

### Step 4: Try Delete Again
1. Go to test2 organization
2. Click Settings tab - should be visible now
3. Scroll to Danger Zone
4. Type "test2" and click Delete
5. Should work ✅

---

## If Still Failing

### Debug the Delete Button State
In browser DevTools console, check the button disabled state:
```javascript
// Get the delete button element
const deleteBtn = document.querySelector('button:contains("Delete")')
console.log('Button disabled:', deleteBtn?.disabled)
console.log('Delete confirmation value:', document.querySelector('#delete-confirm')?.value)
```

Button is disabled if:
- Confirmation text doesn't match: `deleteConfirmation !== currentOrganization?.name`
- Deletion is in progress: `isDeleting === true`
- User not logged in as owner/super_admin

---

## Check Edge Function Logs
1. Go to Supabase Dashboard
2. Go to Functions → organizations
3. Click Logs tab
4. Trigger the delete
5. Look for logs like:
   - ✅ `User is super admin, allowing delete`
   - ❌ `You do not have permission to delete this organization`
   - ❌ `Failed to delete organization: ...`

---

## Super Admin Permissions Summary

| Permission | Owner | Admin | Member | Viewer | Super Admin |
|-----------|-------|-------|--------|--------|------------|
| Management Organization Settings | ✅ | ✅ | ❌ | ❌ | ✅ **ALL** |
| Add/Remove Members | ✅ | ✅ | ❌ | ❌ | ✅ **ALL** |
| Create Devices | ✅ | ✅ | ✅ | ❌ | ✅ **ALL** |
| View Data | ✅ | ✅ | ✅ | ✅ | ✅ **ALL** |
| **DELETE Organization** | ✅ | ❌ | ❌ | ❌ | ✅ **ANY** |
| Manage All Child Orgs | ❌ | ❌ | ❌ | ❌ | ✅ **YES** |

---

## Still Need Help?

If after Step 2 (re-authentication) the delete button is STILL grayed out:

1. **Check your browser's Network tab** while clicking Settings
   - Should see API calls to fetch organization
   - Look for errors like 403 Forbidden

2. **Check Supabase Function logs**
   - Functions → organizations → Logs
   - Run a test API call and see what error appears

3. **Rule out caching**
   - Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
   - Or clear all site data for your domain
