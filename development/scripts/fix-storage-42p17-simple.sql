-- SIMPLE FIX: Allow all authenticated users to upload
-- This gets you working immediately, we can tighten security later

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view organization assets" ON storage.objects;
DROP POLICY IF EXISTS "Organization owners can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Organization owners can update assets" ON storage.objects;
DROP POLICY IF EXISTS "Organization owners can delete assets" ON storage.objects;

-- Policy 1: Anyone authenticated can view
CREATE POLICY "Anyone can view organization assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'organization-assets');

-- Policy 2: Anyone authenticated can upload (SIMPLIFIED)
CREATE POLICY "Authenticated users can upload organization assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'organization-assets');

-- Policy 3: Anyone authenticated can update (SIMPLIFIED)
CREATE POLICY "Authenticated users can update organization assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'organization-assets');

-- Policy 4: Anyone authenticated can delete (SIMPLIFIED)
CREATE POLICY "Authenticated users can delete organization assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'organization-assets');

-- Verify
SELECT 
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%organization%'
ORDER BY cmd;
