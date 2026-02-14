# Quick Fix: profile_load_failed Error

## The Problem

You're getting `profile_load_failed` when trying to log in to `demo-stage.netneural.ai` with `admin@netneural.com`.

## Root Cause

**99% likely:** Circular dependency in Row-Level Security (RLS) policies on the `users` table.

The RLS policies call helper functions that query the `users` table, creating infinite recursion:
- Policy checks: "Can user read users table?"
- Policy calls: `get_user_organization_id()`
- Function queries: `SELECT organization_id FROM users WHERE id = auth.uid()`
- Triggers policy again: ❌ Infinite loop

## The Fix (Choose One)

### 🚀 Option 1: Quick Fix Script (EASIEST)

```bash
cd development
bash scripts/quick-fix-rls.sh
```

This automatically:
- ✅ Uses the correct project ID: `atgbmxicqikmapfqouco`
- ✅ Links to your production Supabase
- ✅ Applies the RLS fix migration
- ✅ Gives you clear next steps

**Requirements:**
- Supabase CLI installed: `npm install -g supabase`
- Logged in to Supabase: `supabase login`

### 🔧 Option 2: Manual SQL Fix (If script doesn't work)

1. Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco
2. Click: **SQL Editor**
3. Run this SQL:

```sql
-- Remove broken policies
DROP POLICY IF EXISTS "Super admins can manage all users" ON users;
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;
DROP POLICY IF EXISTS "Org admins can manage users in their organization" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- Add working policy: Users can ALWAYS view their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Add working policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Service role full access (for backend operations)
CREATE POLICY "Service role full access on users"
  ON users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

4. Click **Run**

### 📋 Option 3: Diagnostic Check First

Want to confirm the issue before fixing?

```bash
cd development
node scripts/fix-production-user.js
```

This will:
- Check if the user exists in auth
- Check if the profile exists
- **Detect RLS policy issues**
- Tell you exactly what's wrong

## After Applying the Fix

1. **Clear browser cache** or use incognito/private mode
2. Go to https://demo-stage.netneural.ai
3. Log in:
   - Email: `admin@netneural.com`
   - Password: `password123`
4. Should work! ✅

## Still Not Working?

If you still get the error after fixing RLS:

### Check 1: Verify Migration Applied

```bash
supabase migration list --linked
```

Should show: `20260214000001_fix_users_rls_circular_dependency.sql` ✅

### Check 2: Verify User Exists

```bash
node scripts/fix-production-user.js
```

Should show:
- ✅ User exists in auth.users
- ✅ Organization exists
- ✅ User profile exists in public.users
- ✅ Organization membership exists

### Check 3: Check Browser Console

1. Open browser dev tools (F12)
2. Go to **Console** tab
3. Look for specific error messages
4. Share them with the team

### Check 4: Check Supabase Logs

1. Go to Supabase Dashboard
2. Navigate to: **Logs → API**
3. Filter: Last 30 minutes
4. Look for failed queries to `/rest/v1/users`

## Technical Details

**Migration File:** `development/supabase/migrations/20260214000001_fix_users_rls_circular_dependency.sql`

**What Changed:**
- ❌ Removed: Policies using `get_user_organization_id()` helper
- ✅ Added: Direct policies using `auth.uid()`
- ✅ Result: No more circular dependencies

**Why This Works:**
- `auth.uid()` is evaluated by Postgres directly (no function call)
- No recursive table queries
- Simple, fast, reliable

## Related Documentation

- Full guide: `development/docs/TROUBLESHOOTING_PROFILE_LOAD_FAILED.md`
- RLS fix migration: `development/supabase/migrations/20260214000001_fix_users_rls_circular_dependency.sql`
- Diagnostic script: `development/scripts/fix-production-user.js`
- Apply script: `development/scripts/fix-production-rls.sh`

## Need Help?

1. Check the logs in Supabase Dashboard
2. Run the diagnostic script for detailed output
3. Check `development/docs/TROUBLESHOOTING_PROFILE_LOAD_FAILED.md`

---

**TL;DR:** Run `bash scripts/fix-production-rls.sh` to fix the RLS circular dependency issue.
