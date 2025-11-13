-- Test which UUID function is available
-- Run in Supabase SQL Editor

-- Test 1: uuid-ossp function with schema prefix
SELECT public.uuid_generate_v4() as test1;

-- Test 2: uuid-ossp function without prefix  
SELECT uuid_generate_v4() as test2;

-- Test 3: built-in gen_random_uuid (PostgreSQL 13+)
SELECT gen_random_uuid() as test3;

-- Show available extensions
SELECT extname, extversion, nspname 
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE extname IN ('uuid-ossp', 'pgcrypto');
