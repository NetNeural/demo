# Debug: Super Admin "Create Organization" Not Showing

## Problem

User logged in as `superadmin@netneural.ai` but the "Create Organization" option is not visible in the sidebar organization dropdown.

## Root Cause Analysis

The implementation is correct, but there are a few potential issues:

### 1. **User Context Not Refreshed After Login** ✓ Most Likely

When you log in, the `UserContext` loads the user profile. However, if the browser already had cached data or if the context hasn't refreshed, `user.isSuperAdmin` might be `false` or `undefined`.

**Check in Browser Console:**

```javascript
// Open browser console (F12)
// Navigate to Components tab (React DevTools)
// Find UserContext Provider
// Check user.isSuperAdmin value
```

### 2. **Database Entry Issue**

The super admin user might not have `role = 'super_admin'` in the `users` table.

**Verify in Supabase:**

```sql
-- Run in Supabase SQL Editor
SELECT id, email, role, organization_id
FROM users
WHERE email = 'superadmin@netneural.ai';

-- Should return:
-- role: 'super_admin'
-- organization_id: NULL
```

### 3. **Auth Flow Issue**

The `getCurrentUser()` function in `lib/auth.ts` might not be setting `isSuperAdmin` correctly.

---

## Solution Steps

### Step 1: Check Browser Console (Immediate Debug)

1. **Open Developer Tools** (F12)
2. **Go to Console tab**
3. **Type this command:**

   ```javascript
   // Check user context
   const userContext = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers
     ?.values()
     .next()?.value
   console.log('User loaded:', userContext)
   ```

4. **Or use React DevTools:**
   - Install React Developer Tools extension
   - Open Components tab
   - Find `UserProvider` component
   - Check the `value` prop
   - Look for `user.isSuperAdmin`

### Step 2: Verify Database Entry

Run this in Supabase SQL Editor:

```sql
-- Check users table
SELECT
  u.id,
  u.email,
  u.role,
  u.organization_id,
  u.full_name,
  u.is_active
FROM users u
WHERE u.email = 'superadmin@netneural.ai';

-- Should return:
-- email: superadmin@netneural.ai
-- role: super_admin  ✓
-- organization_id: NULL  ✓
-- is_active: true  ✓
```

If this returns empty or wrong role, run:

```sql
-- Fix the users table entry
UPDATE users
SET role = 'super_admin',
    organization_id = NULL
WHERE email = 'superadmin@netneural.ai';

-- Or recreate if missing
INSERT INTO users (id, email, full_name, role, organization_id, is_active)
VALUES (
  '10000000-0000-0000-0000-000000000000',
  'superadmin@netneural.ai',
  'Super Administrator',
  'super_admin',
  NULL,
  true
)
ON CONFLICT (id) DO UPDATE
SET role = 'super_admin',
    organization_id = NULL;
```

### Step 3: Force Re-login (Recommended)

**The simplest solution:**

1. **Clear browser cache and cookies**
2. **Log out completely**
3. **Close all browser tabs**
4. **Re-login with:**
   - Email: `superadmin@netneural.ai`
   - Password: `SuperSecure123!`

This forces the `UserContext` to reload fresh data from the database.

### Step 4: Add Debug Logging (If Still Not Working)

Add console.log to see what's happening:

**Edit `src/components/organizations/OrganizationSwitcher.tsx`:**

```tsx
export function OrganizationSwitcher({
  className,
  showCreateButton = true,
  compact = false
}: OrganizationSwitcherProps) {
  const {
    currentOrganization,
    userOrganizations,
    switchOrganization,
    isLoading
  } = useOrganization();

  const { user } = useUser();
  const isSuperAdmin = user?.isSuperAdmin || false;

  // 🔍 DEBUG: Log user info
  console.log('OrganizationSwitcher - User:', {
    email: user?.email,
    role: user?.role,
    isSuperAdmin: user?.isSuperAdmin,
    calculatedIsSuperAdmin: isSuperAdmin,
    showCreateButton: showCreateButton
  });

  const [open, setOpen] = useState(false);
  // ... rest of component
```

**Edit `src/lib/auth.ts`:**

```typescript
export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = createClient()

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user || authError) {
    return null
  }

  // Get user's profile with organization info
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    console.error('Failed to fetch user profile:', profileError)
    return null
  }

  // 🔍 DEBUG: Log profile data
  console.log('getCurrentUser - Profile:', {
    email: user.email,
    role: profile.role,
    organization_id: profile.organization_id,
    isSuperAdmin: profile.role === 'super_admin'
  });

  // ... rest of function
```

### Step 5: Verify Auth Policy (If Database is Correct)

Check that RLS policies allow reading the correct role:

```sql
-- Run in Supabase SQL Editor
-- Check RLS policies on users table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users';
```

Make sure there's a policy like:

```sql
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
ON users FOR SELECT
USING (auth.uid() = id);
```

---

## Quick Fix Script

If you want to ensure everything is set up correctly, run:

```bash
# In terminal at development/
npm run db:reset
```

This will:

1. Reset the database
2. Run migrations
3. Seed data (creates organizations)
4. Create test users (including super admin)

Then log in fresh.

---

## Verification Checklist

After implementing the fix, verify:

- [ ] Can log in as `superadmin@netneural.ai` / `SuperSecure123!`
- [ ] User profile shows in sidebar (email visible)
- [ ] Click organization dropdown in sidebar
- [ ] See list of organizations
- [ ] See "──────────────────" separator at bottom
- [ ] See **"+ Create Organization"** option below separator ✅
- [ ] Option is styled in blue (`text-blue-600`)
- [ ] Clicking it logs "Create organization clicked" in console

---

## Expected Behavior

### For Super Admin (superadmin@netneural.ai):

```
Organization Dropdown:
├── NetNeural Demo ✓ (current)
├── ──────────────────────────────
└── + Create Organization  <-- THIS SHOULD BE VISIBLE
```

### For Regular Users (admin@netneural.ai, user@netneural.ai):

```
Organization Dropdown:
├── NetNeural Demo ✓ (current)
└── (No "Create Organization" option)
```

---

## Common Issues & Solutions

### Issue 1: "Create Organization" shows for everyone

**Cause:** `isSuperAdmin` check not working
**Fix:** Verify database has `role = 'super_admin'` for the user

### Issue 2: "Create Organization" shows for no one

**Cause:** `showCreateButton` prop is false
**Fix:** Check where `<OrganizationSwitcher />` is used in sidebar

### Issue 3: User context is null or undefined

**Cause:** UserContext not loaded yet or auth failed
**Fix:** Re-login, check network tab for auth errors

### Issue 4: Database role is correct but still not showing

**Cause:** Browser cache or stale context
**Fix:** Hard refresh (Ctrl+Shift+R), clear cookies, re-login

---

## Test Plan

### Test Case 1: Super Admin Login

1. Log out completely
2. Clear browser cookies/cache
3. Navigate to `/auth/login`
4. Log in as `superadmin@netneural.ai` / `SuperSecure123!`
5. Navigate to any dashboard page
6. Click organization dropdown in sidebar
7. **EXPECTED:** See "Create Organization" at bottom

### Test Case 2: Regular User Login

1. Log out
2. Log in as `admin@netneural.ai` / `password123`
3. Click organization dropdown in sidebar
4. **EXPECTED:** NO "Create Organization" option

### Test Case 3: Console Logging

1. Open browser console (F12)
2. Refresh page
3. Click organization dropdown
4. **EXPECTED:** See console.log with user info showing `isSuperAdmin: true`

---

## Next Steps

**If "Create Organization" now shows:**

1. Click it and verify console logs "Create organization clicked"
2. Ready to implement the create organization dialog

**If still not showing:**

1. Share the console.log output from debug logging
2. Share the SQL query result from `SELECT * FROM users WHERE email = 'superadmin@netneural.ai'`
3. Check network tab for any auth errors

---

## Code Reference

**Location of Super Admin Check:**

- File: `src/components/organizations/OrganizationSwitcher.tsx`
- Line: ~183-196
- Code: `{showCreateButton && isSuperAdmin && (...)`

**Location of User Loading:**

- File: `src/lib/auth.ts`
- Function: `getCurrentUser()`
- Line: ~50-60
- Code: `isSuperAdmin: profile.role === 'super_admin'`

**Location of Database Setup:**

- File: `scripts/create-test-users.js`
- User ID: `10000000-0000-0000-0000-000000000000`
- Role: `super_admin`
- Organization ID: `null`

---

## Summary

**Most Likely Solution:** Log out and log back in to refresh the user context.

**Why:** The browser might have cached the old user profile before `isSuperAdmin` was implemented. A fresh login will load the correct role from the database.

**Quick Test:**

1. Open browser console (F12)
2. Run: `localStorage.clear(); sessionStorage.clear();`
3. Refresh page
4. Log in again
5. Check organization dropdown
