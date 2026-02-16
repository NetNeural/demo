-- FIX: Repair broken foreign key constraint causing 42P17
-- The objects_bucketId_fkey constraint is malformed

-- Step 1: Drop the broken foreign key constraint
ALTER TABLE storage.objects 
DROP CONSTRAINT IF EXISTS objects_bucketId_fkey;

-- Step 2: Recreate the foreign key constraint properly
ALTER TABLE storage.objects
ADD CONSTRAINT objects_bucketId_fkey 
FOREIGN KEY (bucket_id) 
REFERENCES storage.buckets(id)
ON DELETE CASCADE;

-- Step 3: Verify the fix
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
  AND tc.constraint_name = 'objects_bucketId_fkey';

-- Step 4: Test insert to confirm it works now
DO $$
BEGIN
  INSERT INTO storage.objects (bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
  VALUES (
    'organization-assets',
    'test-fix-verification.txt',
    '00000000-0000-0000-0000-000000000000',
    now(),
    now(),
    now(),
    '{}'::jsonb
  );
  RAISE NOTICE '✅ Test insert succeeded - constraint is fixed!';
  
  -- Clean up test data
  DELETE FROM storage.objects 
  WHERE name = 'test-fix-verification.txt' 
    AND bucket_id = 'organization-assets';
  RAISE NOTICE '✅ Test cleanup complete';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Test insert still failing: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;
