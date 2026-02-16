-- FIX: PostgreSQL Error 42P17 - Storage Bucket Configuration
-- This error occurs when the storage bucket is not properly configured in the database
-- 
-- Date: 2026-02-16
-- Issue: organization-assets bucket causing "database error, code: 42P17"
--
-- Run this SQL in Supabase SQL Editor (or via migration) to fix the issue

-- Step 1: Check if bucket exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'organization-assets') THEN
    RAISE NOTICE 'Bucket does not exist - creating now...';
    
    -- Create the bucket
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'organization-assets',
      'organization-assets', 
      true,
      524288, -- 512KB limit
      ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
    );
    
    RAISE NOTICE 'Bucket created successfully';
  ELSE
    RAISE NOTICE 'Bucket already exists - checking configuration...';
    
    -- Update bucket configuration if needed
    UPDATE storage.buckets 
    SET 
      public = true,
      file_size_limit = 524288,
      allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
    WHERE id = 'organization-assets';
    
    RAISE NOTICE 'Bucket configuration updated';
  END IF;
END $$;

-- Step 2: Drop existing policies (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view organization assets" ON storage.objects;
DROP POLICY IF EXISTS "Organization owners can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Organization owners can update assets" ON storage.objects;
DROP POLICY IF EXISTS "Organization owners can delete assets" ON storage.objects;

-- Step 3: Recreate storage policies
-- SELECT policy (view)
CREATE POLICY "Anyone can view organization assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'organization-assets');

-- INSERT policy (upload)
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

-- UPDATE policy
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

-- DELETE policy
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

-- Step 4: Verify the fix
SELECT 
  'Bucket exists: ' || CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'organization-assets') 
                            THEN 'Yes' ELSE 'No' END AS status;

SELECT 
  'Policies count: ' || COUNT(*)::text AS policy_count
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%organization%';

-- Done!
-- Test by uploading a file to: organization-assets/{org-id}/filename.ext
