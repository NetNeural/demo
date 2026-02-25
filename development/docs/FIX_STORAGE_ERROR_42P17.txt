# Fix Storage Error 42P17 - Invalid Object Definition

## Problem
When uploading organization logos to Supabase Storage, you're getting:
```
StorageApiError: database error, code: 42P17
POST https://atgbmxicqikmapfqouco.supabase.co/storage/v1/object/organization-assets/...
```

**PostgreSQL Error 42P17** means **"invalid_object_definition"** - the storage bucket definition in the database is broken or missing.

## Root Cause
The `organization-assets` bucket was likely created via the Supabase API/Dashboard, but:
1. The SQL migration wasn't applied to the staging database, OR
2. The bucket exists but policies are missing/broken, OR
3. The `storage.buckets` table has a configuration issue

## Quick Fix Options

### Option 1: Via Supabase Dashboard (RECOMMENDED - Fastest)

1. Open Supabase SQL Editor:
   ```
   https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql
   ```

2. Run the fix SQL script:
   ```bash
   # Copy the SQL from:
   /workspaces/MonoRepo/development/scripts/fix-storage-42p17.sql
   ```

3. Click "Run" and verify output shows:
   - "Bucket created successfully" or "Bucket configuration updated"
   - "Policies count: 4"

### Option 2: Via Migration (Best Practice)

Apply the migration properly:

```bash
cd /workspaces/MonoRepo/development

# Check which migrations are pending
npx supabase migration list --db-url "postgresql://..."

# Apply all pending migrations
npx supabase db push --db-url "postgresql://..."
```

**Note:** This requires the staging database URL with credentials.

### Option 3: Via GitHub Actions

If you have migrations in queue, trigger a deployment which will run migrations:

```bash
# Commit any pending migrations
git add supabase/migrations/
git commit -m "fix: apply storage bucket migrations"
git push origin main
```

The CI/CD pipeline will automatically apply migrations to staging.

## Verification

After applying the fix:

1. **Check in Supabase Dashboard:**
   - Go to: Storage → Buckets
   - Verify `organization-assets` bucket exists
   - Check: Storage → Policies
   - Verify 4 policies exist for `storage.objects` with "organization" in the name

2. **Test Upload:**
   ```bash
   # In your app, try uploading a logo again
   # It should succeed now
   ```

3. **Check SQL:**
   ```sql
   -- Verify bucket
   SELECT * FROM storage.buckets WHERE id = 'organization-assets';
   
   -- Verify policies
   SELECT policyname FROM pg_policies 
   WHERE schemaname = 'storage' 
     AND tablename = 'objects'
     AND policyname LIKE '%organization%';
   ```

## Expected Configuration

**Bucket Settings:**
- ID: `organization-assets`
- Public: `true` (authenticated users can view)
- File size limit: `524288` (512KB)
- Allowed MIME types: `image/png, image/jpeg, image/jpg, image/webp, image/svg+xml`

**Storage Policies (4 total):**
1. `Anyone can view organization assets` - SELECT
2. `Organization owners can upload assets` - INSERT
3. `Organization owners can update assets` - UPDATE
4. `Organization owners can delete assets` - DELETE

## Prevention

To prevent this in future:

1. **Always use migrations for storage setup:**
   ```bash
   # Create migration
   npx supabase migration new add_storage_bucket
   
   # Add SQL to migration file
   # Commit and deploy
   ```

2. **Never create buckets manually** via Dashboard alone - always have a corresponding migration

3. **Test locally first:**
   ```bash
   npm run dev:full
   # Test uploads locally before deploying to staging
   ```

## Related Files

- Migration: `supabase/migrations/20260216000000_organization_branding_storage.sql`
- Fix SQL: `scripts/fix-storage-42p17.sql`
- Policies SQL: `supabase/migrations/20260216000001_apply_storage_policies.sql`
- Component: `src/app/dashboard/organizations/components/OrganizationSettingsTab.tsx`

## Support

If the issue persists after trying all options:

1. Check Supabase logs:
   ```
   https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/logs/postgres-logs
   ```

2. Verify organization membership:
   ```sql
   SELECT * FROM organization_members WHERE user_id = auth.uid();
   ```

3. Check if RLS is blocking by testing with service role key temporarily

---

**Status:** Ready to apply fix  
**Urgency:** High (blocks organization branding feature)  
**Estimated fix time:** 2-5 minutes
