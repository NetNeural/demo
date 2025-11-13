-- Create uuid_generate_v4() alias for gen_random_uuid()
-- This ensures compatibility with migrations that use uuid_generate_v4()

CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT gen_random_uuid();
$$;

-- Test it works
SELECT uuid_generate_v4();
