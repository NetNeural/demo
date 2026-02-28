# Cloned Environment Troubleshooting Guide

## The Situation

Your **stage environment was cloned from production**, but `admin@netneural.com` login fails with `profile_load_failed`.

## Common Issues with Cloned Environments

When you clone a Supabase project, several things can go wrong:

### 1. ❌ Migrations Not Applied Correctly

**Problem**: Cloned database may have old schema, missing the RLS fix
**Symptom**: Same circular dependency issue as before
**Solution**: Re-apply all migrations

### 2. ❌ Auth Users vs Database Users Mismatch

**Problem**: `auth.users` cloned but `public.users` table empty or mismatched IDs
**Symptom**: User can authenticate but profile loading fails
**Solution**: Sync or recreate user profiles

### 3. ❌ Different User IDs After Clone

**Problem**: New auth users created with different UUIDs than in `public.users`
**Symptom**: Profile exists but doesn't match auth user
**Solution**: Update or recreate with matching IDs

### 4. ❌ Missing Organizations

**Problem**: `public.users` references organization that doesn't exist
**Symptom**: Profile loads but organization lookup fails
**Solution**: Create organization or update references

### 5. ❌ Environment Variables Wrong

**Problem**: Frontend still pointing to old production URLs
**Symptom**: Correct database but wrong API calls
**Solution**: Update environment variables

### 6. ❌ RLS Policies Still Broken

**Problem**: Old policies copied during clone
**Symptom**: Cannot query user profile due to circular dependency
**Solution**: Apply RLS fix migration

## Comprehensive Fix - Run This First

```bash
cd development

# Step 1: Run comprehensive diagnostic
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
node scripts/diagnose-production.js
```

This will tell you exactly what's wrong:
- ✅ Which RLS policies exist
- ✅ If auth user exists  
- ✅ If user profile exists
- ✅ If organization exists
- ✅ If tables are empty
- ✅ What the actual error is

## Fix Based on Diagnostic Results

### Scenario A: Database is Empty

**Diagnostic shows**: "Database is empty or not seeded"

**Solution**: Apply seed data

```bash
# Option 1: Via Supabase CLI (resets everything)
supabase db reset --linked

# Option 2: Via Dashboard SQL Editor
# Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql/new
# Copy/paste contents of: development/supabase/seed.sql
# Click RUN
```

### Scenario B: User Exists in Auth, Missing in public.users

**Diagnostic shows**: "User exists in auth but NOT in public.users"

**Solution**: Create profile record

```bash
node scripts/fix-production-user.js
```

This will:
1. Find the auth user
2. Create matching profile in `public.users`
3. Link to organization
4. Create membership record

### Scenario C: Wrong/Old RLS Policies

**Diagnostic shows**: "OLD PROBLEMATIC POLICIES STILL EXIST"

**Solution**: Apply RLS fix

```bash
bash scripts/quick-fix-rls.sh
```

Or manually via SQL Editor:
```sql
-- Drop old policies
DROP POLICY IF EXISTS "Super admins can manage all users" ON users;
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;

-- Add new fixed policy
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (id = auth.uid());
```

### Scenario D: User IDs Don't Match

**Diagnostic shows**: User exists in both places but IDs are different

**Solution**: Delete and recreate with matching IDs

```sql
-- 1. Get the auth user ID
SELECT id, email FROM auth.users WHERE email = 'admin@netneural.com';

-- 2. Delete old profile if exists
DELETE FROM users WHERE email = 'admin@netneural.com';

-- 3. Insert with correct ID (from step 1)
INSERT INTO users (id, email, full_name, role, organization_id)
VALUES (
  'ID_FROM_STEP_1',  -- Use actual ID from auth.users
  'admin@netneural.com',
  'Admin User',
  'org_owner',
  '00000000-0000-0000-0000-000000000001'
);
```

### Scenario E: Organization Missing

**Diagnostic shows**: Users exist but organizations table empty

**Solution**: Create organization

```sql
INSERT INTO organizations (id, name, slug, subscription_tier, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'NetNeural Demo',
  'netneural-demo',
  'enterprise',
  true
);
```

## Complete Fix Process (Step by Step)

### Step 1: Diagnose

```bash
cd development
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
node scripts/diagnose-production.js
```

**Look for** these specific messages:
- "OLD PROBLEMATIC POLICIES STILL EXIST" → Need RLS fix
- "Database is empty" → Need seed data
- "User NOT in public.users" → Need to create profile
- "Organizations table empty" → Need to create org

### Step 2: Apply Fixes Based on Diagnosis

Pick the appropriate solution from above based on what diagnostic found.

### Step 3: Re-run Diagnostic

```bash
node scripts/diagnose-production.js
```

Should now show:
- ✅ NEW FIXED POLICY EXISTS
- ✅ User exists in auth.users
- ✅ User profile exists with correct ID
- ✅ Organization exists
- ✅ Successfully fetched profile

### Step 4: Test Login

1. Clear browser cache or use incognito
2. Go to: https://demo-stage.netneural.ai
3. Log in:
   - Email: admin@netneural.com
   - Password: password123
4. Should work! ✅

## Quick Reference: All Fix Scripts

```bash
# 1. Comprehensive diagnostic (RUN THIS FIRST!)
export SUPABASE_SERVICE_ROLE_KEY=your-key
node scripts/diagnose-production.js

# 2. Apply all migrations + check data
bash scripts/fix-cloned-environment.sh

# 3. Fix RLS policies only
bash scripts/quick-fix-rls.sh

# 4. Create missing user profile
node scripts/fix-production-user.js

# 5. Full database reset (DESTRUCTIVE!)
supabase db reset --linked
```

## Environment Variables to Check

Make sure your frontend is pointing to the correct stage environment:

```bash
# In .env.production or GitHub Secrets
NEXT_PUBLIC_SUPABASE_URL=https://atgbmxicqikmapfqouco.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get these from:
https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/settings/api

## Still Not Working?

If you've tried everything and still get `profile_load_failed`:

### 1. Check Browser Console

Open Dev Tools (F12) → Console tab
Look for specific errors like:
- "Failed to fetch user profile: {error details}"
- "policy violation" or "permission denied"
- API errors with status codes

### 2. Check Supabase Logs

Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/logs/explorer

Filter for:
- API logs showing failed `/rest/v1/users` requests
- Auth logs showing failed logins
- Specific error messages

### 3. Check Network Tab

Dev Tools (F12) → Network tab
- Filter for "users" 
- Click on failed request
- Check Response tab for exact error
- Check Preview tab for JSON error details

### 4. Test with Service Role Key Directly

This bypasses RLS to confirm data exists:

```javascript
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  'YOUR_SERVICE_ROLE_KEY'  // Get from dashboard
)

async function test() {
  // This should work (bypasses RLS)
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'admin@netneural.com')
  
  console.log('Data:', data)
  console.log('Error:', error)
}

test()
```

If this works but normal client doesn't, it's definitely an RLS issue.

## Summary

**Most likely issue**: RLS policies not fixed after clone

**Quick fix**: 
```bash
bash scripts/quick-fix-rls.sh
```

**If that doesn't work**: 
```bash
node scripts/diagnose-production.js
```

Then apply specific fix based on diagnostic output.

---

**Need immediate help?** Share the output of `diagnose-production.js` and we can pinpoint the exact issue.
