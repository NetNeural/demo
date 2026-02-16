-- Deep diagnostic for 42P17 error
-- This checks the storage infrastructure itself

-- 1. Check if storage.objects table exists and is healthy
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'storage' 
  AND table_name = 'objects';

-- 2. Check foreign key constraints on storage.objects
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'storage'
  AND tc.table_name = 'objects'
ORDER BY tc.constraint_type;

-- 3. Check if bucket_id column exists and has proper constraint
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'storage' 
  AND table_name = 'objects'
  AND column_name = 'bucket_id';

-- 4. Try a simple test insert to see the actual error
DO $$
DECLARE
  test_error text;
BEGIN
  -- This will fail but show us the real error
  INSERT INTO storage.objects (bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
  VALUES (
    'organization-assets',
    'test-file.txt',
    '00000000-0000-0000-0000-000000000000',
    now(),
    now(),
    now(),
    '{}'::jsonb
  );
  RAISE NOTICE 'Test insert succeeded (unexpected)';
  -- Clean up if it worked
  DELETE FROM storage.objects WHERE name = 'test-file.txt' AND bucket_id = 'organization-assets';
EXCEPTION WHEN OTHERS THEN
  test_error := SQLERRM;
  RAISE NOTICE 'Test insert error: % (SQLSTATE: %)', test_error, SQLSTATE;
END $$;
