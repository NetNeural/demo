# Troubleshooting: profile_load_failed Error

## Problem

When trying to log in to `demo-stage.netneural.ai` with `admin@netneural.com`, you see:
```
Error: profile_load_failed
```

## Root Cause

This error can occur due to **two main reasons**:

### 1. Circular Dependency in RLS Policies (Most Common)

The `users` table has Row-Level Security (RLS) policies that call helper functions like `get_user_organization_id()`, which query the `users` table again, creating infinite recursion:

```sql
-- Helper function (in RLS policy)
CREATE FUNCTION get_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql;

-- Policy that uses it
CREATE POLICY "Users can view org members" ON users
  FOR SELECT USING (organization_id = get_user_organization_id());

-- ❌ Circular: Policy calls function → function queries users → policy blocks query
```

**Symptoms:**
- Login fails with `profile_load_failed`
- Browser console shows: "Failed to fetch user profile"
- No user record appears in database queries (even though it exists)

**Solution:** Apply the RLS fix migration (see below)

### 2. Missing User Profile Record

User can authenticate successfully (auth.users table) but profile record is missing in `public.users` table.

The application requires **both**:
- ✅ Auth user record (in `auth.users`)
- ✅ Profile record (in `public.users` with valid `organization_id`)

**Symptoms:**
- User exists in Supabase Auth dashboard
- No corresponding record in public.users table
- Login fails after successful authentication

**Solution:** Create the missing profile record (see below)

## How getCurrentUser() Works

```typescript
// 1. Get authenticated user from Supabase Auth
const { data: { user } } = await supabase.auth.getUser()

// 2. Fetch user profile from public.users table
const { data: profile } = await supabase
  .from('users')
  .select('role, organization_id')
  .eq('id', user.id)
  .single()

// 3. If profile missing or invalid → return null → triggers error
if (!profile) return null

// 4. For non-super-admin users, fetch organization
let organization = null
if (profile.organization_id) {
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', profile.organization_id)
    .single()
  organization = org
}

// 5. Regular users MUST have an organization
if (!isSuperAdmin && !organization) {
  console.error('User has no organization assigned')
  return null  // ❌ Triggers profile_load_failed
}
```

## Quick Fix - Automated Scripts

### Fix 1: Apply RLS Migration (Try This First!)

Most likely this is an RLS policy issue. Apply the fix migration:

```bash
cd development

# Method 1: Use the automated fix script
bash scripts/fix-production-rls.sh

# Method 2: Manual migration
export NEXT_PUBLIC_SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

supabase link --project-ref bldojxpockljyivldxwf
supabase db push --linked
```

This applies the migration `20260214000001_fix_users_rls_circular_dependency.sql` which:
- ✅ Removes circular helper function calls
- ✅ Creates direct RLS policies using `auth.uid()`
- ✅ Fixes infinite recursion in users table queries

### Fix 2: Run Diagnostic Script

If RLS fix doesn't work, check for missing profile data:

```bash
cd development

# Make sure you have production environment variables
cat .env.production  # Should have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

# Run the fix script
node scripts/fix-production-user.js
```

This script will:
1. ✅ Check if user exists in `auth.users`
2. ✅ Check if organization exists
3. ✅ Check if user profile exists in `public.users`
4. ✅ Check if organization membership exists
5. ✅ **Detect RLS policy issues and recommend fix**
6. 🔧 Create any missing records automatically

## Manual Fix - For RLS Issues

If you can't run the migration script, apply the fix manually:

### Via Supabase Studio SQL Editor

1. Go to https://supabase.com/dashboard/project/atgbmxicqikmapfqouco
2. Navigate to: **SQL Editor**
3. Create a new query and run the contents of:
   `development/supabase/migrations/20260214000001_fix_users_rls_circular_dependency.sql`

Or copy this quick fix:

```sql
-- Drop problematic policies
DROP POLICY IF EXISTS "Super admins can manage all users" ON users;
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;
DROP POLICY IF EXISTS "Org admins can manage users in their organization" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- Critical: Users can ALWAYS view their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile  
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Service role full access
CREATE POLICY "Service role full access on users"
  ON users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

## Manual Fix - For Missing Profile Data

If the RLS is fixed but you still get errors, the profile might be missing:

### Option 1: Via Supabase Studio SQL Editor

1. Go to https://supabase.com/dashboard/project/atgbmxicqikmapfqouco
2. Navigate to: SQL Editor
3. Run this SQL:

```sql
-- Check if user exists in auth
SELECT id, email, email_confirmed_at 
FROM auth.users 
WHERE email = 'admin@netneural.com';

-- Check if organization exists
SELECT * FROM organizations WHERE id = '00000000-0000-0000-0000-000000000001';

-- Check if user profile exists
SELECT * FROM users WHERE email = 'admin@netneural.com';

-- If organization is missing, create it:
INSERT INTO organizations (id, name, slug, description, subscription_tier, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'NetNeural Demo',
  'netneural-demo',
  'Demo organization for NetNeural IoT Platform',
  'enterprise',
  true
)
ON CONFLICT (id) DO NOTHING;

-- If user profile is missing, create it:
-- (Replace USER_ID with the actual ID from auth.users query above)
INSERT INTO users (id, email, full_name, role, organization_id)
VALUES (
  'USER_ID_FROM_AUTH_USERS',  -- Replace with actual ID
  'admin@netneural.com',
  'Admin User',
  'org_owner',
  '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Create organization membership
INSERT INTO organization_members (organization_id, user_id, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'USER_ID_FROM_AUTH_USERS',  -- Replace with actual ID
  'owner'
)
ON CONFLICT (organization_id, user_id) DO NOTHING;
```

### Option 2: Via Table Editor

1. Go to Supabase Dashboard → Table Editor
2. Click on `users` table
3. Click "Insert" → "Insert row"
4. Fill in:
   - `id`: (copy from auth.users)
   - `email`: admin@netneural.com
   - `full_name`: Admin User
   - `role`: org_owner
   - `organization_id`: 00000000-0000-0000-0000-000000000001

## Complete Production Setup

If the production database is completely empty, you should run the full seed:

```bash
cd development

# Get production database URL from Supabase Dashboard
# Project Settings → Database → Connection string

# Option 1: Apply full seed.sql
psql "postgresql://postgres:[PASSWORD]@db.atgbmxicqikmapfqouco.supabase.co:5432/postgres" \
  -f supabase/seed.sql

# Option 2: Use Supabase CLI
supabase link --project-ref atgbmxicqikmapfqouco
supabase db reset --linked  # WARNING: This will DROP all data!
```

## Verification Steps

After applying the fix:

1. **Clear browser cache** or use incognito mode
2. Go to https://demo-stage.netneural.ai
3. Log in with:
   - Email: `admin@netneural.com`
   - Password: `password123`
4. Should successfully reach the dashboard

## Additional Debugging

If the error persists:

### Check RLS Policies

The error could also be caused by Row-Level Security policies blocking the query:

```sql
-- Check RLS policies on users table
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Temporarily disable RLS for testing (NOT for production!)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

### Check Browser Console

1. Open browser developer tools (F12)
2. Go to Console tab
3. Look for error messages like:
   - "Failed to fetch user profile"
   - "User has no organization assigned"
4. Go to Network tab
5. Filter for "users" or "organizations"
6. Check the response from Supabase API calls

### Check Supabase Logs

1. Go to Supabase Dashboard
2. Navigate to: Logs → API
3. Filter by: Last 30 minutes
4. Look for failed queries from `/rest/v1/users`

## Prevention

To prevent this issue in the future:

1. **Always apply migrations to production**:
   ```bash
   supabase db push --linked
   ```

2. **Always create both auth user AND profile**:
   - Auth user in `auth.users` (via Supabase Auth)
   - Profile in `public.users` (via database trigger or manual insert)

3. **Use the seed.sql for initial setup**:
   - Contains all required test data
   - Creates proper relationships
   - Sets up auth users with passwords

4. **Set up database triggers** to auto-create profiles:
   ```sql
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS TRIGGER AS $$
   BEGIN
     INSERT INTO public.users (id, email, full_name, role)
     VALUES (
       NEW.id,
       NEW.email,
       COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
       COALESCE(NEW.raw_user_meta_data->>'role', 'user')
     );
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
   ```

## Common Mistakes

❌ **Creating auth user without profile**
```javascript
// This only creates auth.users record!
await supabase.auth.signUp({ email, password })
// Missing: Insert into public.users table
```

✅ **Correct approach**
```javascript
// 1. Create auth user
const { data } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true
})

// 2. Create profile (or rely on database trigger)
await supabase.from('users').insert({
  id: data.user.id,
  email,
  full_name: 'User Name',
  role: 'user',
  organization_id: 'some-org-id'
})
```

## Summary

**Problem**: `profile_load_failed` when logging in
**Cause**: Missing or incomplete user profile in `public.users` table
**Solution**: Run `node scripts/fix-production-user.js` or manually insert records
**Prevention**: Always keep auth.users and public.users in sync

---

**Need More Help?**
- Check Supabase logs: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/logs
- Check application code: `development/src/lib/auth.ts` (getCurrentUser function)
- Check user context: `development/src/contexts/UserContext.tsx` (loadUser function)
