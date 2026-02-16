-- FIX v2: PostgreSQL Error 42P17 - Storage Bucket Configuration
-- More robust version with better error handling
-- Date: 2026-02-16

-- Step 1: Ensure bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-assets',
  'organization-assets', 
  true,
  524288, -- 512KB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Step 2: Drop ALL existing organization-related policies
DO $$ 
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname LIKE '%organization%'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON storage.objects';
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Step 3: Create policies one by one with explicit error handling

-- Policy 1: SELECT (View)
DO $$
BEGIN
  CREATE POLICY "Anyone can view organization assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'organization-assets');
  RAISE NOTICE 'Created SELECT policy';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SELECT policy error: %', SQLERRM;
END $$;

-- Policy 2: INSERT (Upload)
DO $$
BEGIN
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
  RAISE NOTICE 'Created INSERT policy';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'INSERT policy error: %', SQLERRM;
END $$;

-- Policy 3: UPDATE
DO $$
BEGIN
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
  RAISE NOTICE 'Created UPDATE policy';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'UPDATE policy error: %', SQLERRM;
END $$;

-- Policy 4: DELETE
DO $$
BEGIN
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
  RAISE NOTICE 'Created DELETE policy';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'DELETE policy error: %', SQLERRM;
END $$;

-- Step 4: Verify
SELECT 
  'Bucket: ' || id || ' (public=' || public || ', limit=' || file_size_limit || ')' as bucket_status
FROM storage.buckets 
WHERE id = 'organization-assets';

SELECT 
  policyname,
  cmd as operation,
  CASE WHEN roles::text LIKE '%authenticated%' THEN 'authenticated' ELSE roles::text END as who
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%organization%'
ORDER BY cmd;
