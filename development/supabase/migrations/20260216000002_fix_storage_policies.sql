-- Fix storage policies - use simpler approach without storage.foldername()
-- The function storage.foldername() may not exist, causing 42P17 error

-- Drop the problematic policies
DROP POLICY IF EXISTS "Anyone can view organization assets" ON storage.objects;
DROP POLICY IF EXISTS "Organization owners can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Organization owners can update assets" ON storage.objects;
DROP POLICY IF EXISTS "Organization owners can delete assets" ON storage.objects;

-- Simpler approach: Check if user is an owner of ANY organization
-- The file path format is: organization_id/filename
-- We'll extract the org ID from the path

-- Allow authenticated users to view all organization assets
CREATE POLICY "Anyone can view organization assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'organization-assets');

-- Allow organization owners to upload assets
-- Check if first part of path matches an org they own
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
