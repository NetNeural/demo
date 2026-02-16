# Storage Upload Error 42P17 - SOLUTION

## 🔴 Problem
```
StorageApiError: database error, code: 42P17
POST /storage/v1/object/organization-assets/...logo.webp 500
```

**Cause:** Storage bucket `organization-assets` is not properly configured in the database.

## ✅ FASTEST FIX (Choose One)

### Option A: GitHub Actions (1-Click) ⭐ RECOMMENDED

1. Go to: https://github.com/NetNeural/MonoRepo-Staging/actions/workflows/fix-storage-42p17.yml
2. Click **"Run workflow"**
3. Select environment: **staging**
4. Click **"Run workflow"** button
5. Wait 30 seconds for completion

### Option B: Supabase SQL Editor (Manual)

1. Open: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql
2. Copy/paste SQL from: `development/scripts/fix-storage-42p17.sql`
3. Click **"Run"**
4. Verify output shows: "Bucket created successfully"

### Option C: Deploy Migrations

```bash
cd /workspaces/MonoRepo/development

# Push all pending migrations to staging
npx supabase db push \
  --db-url "postgresql://postgres:[SERVICE_KEY]@db.atgbmxicqikmapfqouco.supabase.co:5432/postgres"
```

## 📋 What Gets Fixed

1. ✅ Creates `organization-assets` storage bucket (512KB limit)
2. ✅ Applies 4 storage policies:
   - SELECT: Anyone can view
   - INSERT: Org owners can upload
   - UPDATE: Org owners can update
   - DELETE: Org owners can delete
3. ✅ Sets allowed types: PNG, JPG, WebP, SVG

## 🧪 Verify Fix

After applying fix, test:

```bash
# 1. Check bucket exists
curl -X GET https://atgbmxicqikmapfqouco.supabase.co/storage/v1/bucket/organization-assets \
  -H "Authorization: Bearer [ANON_KEY]"

# 2. Try uploading in app
# Go to: https://demo-stage.netneural.ai/dashboard/organizations
# Click "Settings" → Upload logo
# Should succeed without 42P17 error
```

Or check in SQL Editor:
```sql
SELECT * FROM storage.buckets WHERE id = 'organization-assets';
SELECT COUNT(*) FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE '%organization%';
-- Should show: 4 policies
```

## 📚 Related Files

- **Fix SQL**: [`scripts/fix-storage-42p17.sql`](scripts/fix-storage-42p17.sql)
- **Documentation**: [`docs/FIX_STORAGE_ERROR_42P17.md`](docs/FIX_STORAGE_ERROR_42P17.md)
- **GitHub Action**: [`../.github/workflows/fix-storage-42p17.yml`](../.github/workflows/fix-storage-42p17.yml)
- **Migration**: [`supabase/migrations/20260216000000_organization_branding_storage.sql`](supabase/migrations/20260216000000_organization_branding_storage.sql)

## 🎯 Next Steps

After fix is applied:
1. Test logo upload in app
2. Verify no more 42P17 errors in console
3. Check favicon.ico 404 error (minor - just add favicon to `public/`)

---

**Estimated fix time:** 2-5 minutes  
**Impact:** Unblocks organization branding feature
