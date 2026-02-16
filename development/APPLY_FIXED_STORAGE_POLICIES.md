🔧 APPLY THIS SQL IN SUPABASE SQL EDITOR
============================================

Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql/new

Paste and run this entire SQL block:

```sql
-- Fix storage policies - remove dependency on storage.foldername()
-- Error 42P17: undefined_object means the function doesn't exist

-- Drop the problematic policies
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
-- Uses split_part() instead of storage.foldername()
CREATE POLICY "Organization owners can upload assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'organization-assets'
  AND EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
      AND om.organization_id::text = split_part(name, '/', 1)
  )
);

-- Allow organization owners to update their assets
CREATE POLICY "Organization owners can update assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'organization-assets'
  AND EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
      AND om.organization_id::text = split_part(name, '/', 1)
  )
);

-- Allow organization owners to delete their assets
CREATE POLICY "Organization owners can delete assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'organization-assets'
  AND EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
      AND om.organization_id::text = split_part(name, '/', 1)
  )
);

-- Verify policies created
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects' 
AND policyname LIKE '%organization%';
```

After running this, you should see 4 policies listed. Then try uploading the logo again.
