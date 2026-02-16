# Apply Storage Policies for Organization Branding

## Issue
Logo uploads are failing with: "new row violates row-level security policy"

## Solution
The storage policies need to be applied manually in the Supabase Dashboard.

## Steps to Apply

### Option 1: Via Supabase SQL Editor (Recommended)

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql/new

2. **Copy and paste ALL of the SQL below:**

```sql
-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can view organization assets" ON storage.objects;
DROP POLICY IF EXISTS "Organization owners can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Organization owners can update assets" ON storage.objects;
DROP POLICY IF EXISTS "Organization owners can delete assets" ON storage.objects;

-- Allow authenticated users to view all organization assets
CREATE POLICY "Anyone can view organization assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'organization-assets');

-- Allow organization owners to upload assets
CREATE POLICY "Organization owners can upload assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'organization-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT o.id
    FROM organizations o
    INNER JOIN organization_members om ON o.id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
  )
);

-- Allow organization owners to update their assets
CREATE POLICY "Organization owners can update assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'organization-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT o.id
    FROM organizations o
    INNER JOIN organization_members om ON o.id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
  )
);

-- Allow organization owners to delete their assets
CREATE POLICY "Organization owners can delete assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'organization-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT o.id
    FROM organizations o
    INNER JOIN organization_members om ON o.id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
  )
);
```

3. **Click "Run" to execute**

4. **Verify** the policies were created:
   - Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/storage/policies
   - You should see 4 policies for the `organization-assets` bucket

### Option 2: Via Storage Policies UI

1. Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/storage/policies
2. Click "New Policy" for each of the 4 policies shown in the SQL above
3. Use the SQL policy editor for each one

## Test After Applying

1. Refresh your browser: `Ctrl+Shift+R` (hard reload)
2. Go to: https://demo-stage.netneural.ai/dashboard/organizations/?tab=settings
3. Try uploading a logo again
4. It should work now! ✅

## What These Policies Do

- **SELECT**: Any authenticated user can view logos
- **INSERT**: Only organization owners can upload new logos to their org folder
- **UPDATE**: Only organization owners can update/replace logos in their org folder  
- **DELETE**: Only organization owners can delete logos from their org folder

The folder structure is: `organization-assets/{organization-id}/{filename}`

This ensures users can only manage assets for organizations they own.
