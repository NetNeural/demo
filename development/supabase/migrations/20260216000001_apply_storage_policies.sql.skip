-- Apply storage policies for organization-assets bucket
-- Run this in Supabase SQL Editor or via psql

-- First, drop existing policies if any
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
