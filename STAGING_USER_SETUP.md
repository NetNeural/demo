# Quick Fix: profile_load_failed in Staging

## The Problem

After setting up the staging database, you get `profile_load_failed` when trying to log in. This is because:
- ✅ Database schema exists (migrations applied)
- ❌ No test users created yet
- ❌ No user profile records in `public.users` table

## Quick Fix (Choose One Method)

### Method 1: Automated Script (Recommended)

```bash
cd /workspaces/MonoRepo/development

# Get your staging credentials from GitHub secrets or Supabase dashboard
STAGING_URL="https://atgbmxicqikmapfqouco.supabase.co"
STAGING_SERVICE_KEY="eyJ..." # Your staging service role key

# Run the script
STAGING_URL=$STAGING_URL \
STAGING_SERVICE_KEY=$STAGING_SERVICE_KEY \
node scripts/create-staging-user.js
```

**What it creates:**
- ✅ Organization: "NetNeural Staging"
- ✅ Auth user: `staging-admin@netneural.ai`
- ✅ User profile in `public.users` table
- ✅ Organization membership record

**Login credentials:**
- Email: `staging-admin@netneural.ai`
- Password: `StagingTest2026!`

### Method 2: Manual Setup via Supabase Studio

1. **Go to Supabase Studio:**
   https://supabase.com/dashboard/project/atgbmxicqikmapfqouco

2. **Create Organization** (SQL Editor):
   ```sql
   INSERT INTO organizations (id, name, slug, created_at, updated_at)
   VALUES (
     '00000000-0000-0000-0000-000000000001',
     'NetNeural Staging',
     'netneural-staging',
     NOW(),
     NOW()
   );
   ```

3. **Create Auth User** (Authentication → Add User):
   - Email: `staging-admin@netneural.ai`
   - Password: `StagingTest2026!`
   - Auto-confirm email: ✅
   - Copy the generated User ID

4. **Create User Profile** (SQL Editor - replace USER_ID):
   ```sql
   INSERT INTO users (id, email, full_name, role, organization_id, is_active)
   VALUES (
     'PASTE_USER_ID_HERE',
     'staging-admin@netneural.ai',
     'Staging Administrator',
     'org_owner',
     '00000000-0000-0000-0000-000000000001',
     true
   );
   ```

5. **Create Membership** (SQL Editor - replace USER_ID):
   ```sql
   INSERT INTO organization_members (organization_id, user_id, role)
   VALUES (
     '00000000-0000-0000-0000-000000000001',
     'PASTE_USER_ID_HERE',
     'owner'
   );
   ```

### Method 3: Use Seed Script

```bash
cd /workspaces/MonoRepo

# This will create organizations, but you'll still need to 
# manually create auth users via Supabase Studio
./scripts/seed-staging-data.sh
```

Then follow Method 2, step 3 onwards.

## After Creating User

1. **Clear browser cache** or use incognito mode
2. Go to: https://demo-stage.netneural.ai
3. Click "Login"
4. Enter credentials:
   - Email: `staging-admin@netneural.ai`
   - Password: `StagingTest2026!`
5. Should work! ✅

## Troubleshooting

### "Still getting profile_load_failed"

**Check 1: User exists in auth.users**
```bash
# Via Supabase Studio:
# Authentication → Users → Search for staging-admin@netneural.ai
```

**Check 2: Profile exists in public.users**
```sql
-- SQL Editor:
SELECT * FROM users WHERE email = 'staging-admin@netneural.ai';
```

Should return 1 row with:
- ✅ `id`
- ✅ `organization_id` (not null)
- ✅ `role` = 'org_owner'
- ✅ `is_active` = true

**Check 3: Organization exists**
```sql
-- SQL Editor:
SELECT * FROM organizations WHERE id = '00000000-0000-0000-0000-000000000001';
```

**Check 4: Membership exists**
```sql
-- SQL Editor:
SELECT * FROM organization_members 
WHERE user_id = (SELECT id FROM users WHERE email = 'staging-admin@netneural.ai');
```

**Check 5: RLS policies**
```sql
-- Check if RLS is causing issues:
SELECT tablename, policyname, qual, with_check 
FROM pg_policies 
WHERE tablename = 'users';
```

If you see complex policies with function calls, you may need to apply the RLS fix:

```bash
cd /workspaces/MonoRepo/development
npx supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.atgbmxicqikmapfqouco.supabase.co:5432/postgres"
```

### "Cannot get service role key"

1. Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/settings/api
2. Under "Project API keys", copy the `service_role` secret key
3. **Never commit this** - it's a secret!

### "Script fails with permission error"

The service role key should have full access. If it fails:
1. Verify you're using the **service_role** key (not anon key)
2. Check that RLS is enabled on all tables
3. Try running the SQL commands manually in Supabase Studio

## What This Solves

After creating the user:
- ✅ Can log in to staging environment
- ✅ User profile loads correctly
- ✅ Organization context available
- ✅ Full dashboard access
- ✅ Can test all features

## Next Steps

Once logged in successfully:
1. Test all pages work
2. Create additional test devices
3. Test integrations
4. Verify alerts system
5. Run full feature comparison

See: [PROD_VS_STAGING_FEATURE_COMPARISON.md](PROD_VS_STAGING_FEATURE_COMPARISON.md)

---

**Need more help?** Check the full troubleshooting guide: [development/docs/TROUBLESHOOTING_PROFILE_LOAD_FAILED.md](development/docs/TROUBLESHOOTING_PROFILE_LOAD_FAILED.md)
