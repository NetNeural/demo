-- Assessment Report RPC Functions
-- Provides get_table_count and get_rls_policy_count for the assessment-report edge function.
-- These query information_schema to return live infrastructure metrics.

-- ============================================================================
-- get_table_count: Returns the number of user-created tables in public schema
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_table_count()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';
$$;

COMMENT ON FUNCTION public.get_table_count()
  IS 'Returns count of user tables in public schema. Used by assessment-report edge function.';

-- Grant execute to service_role (used by edge functions)
GRANT EXECUTE ON FUNCTION public.get_table_count() TO service_role;

-- ============================================================================
-- get_rls_policy_count: Returns the number of RLS policies across all tables
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_rls_policy_count()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM pg_policies
  WHERE schemaname = 'public';
$$;

COMMENT ON FUNCTION public.get_rls_policy_count()
  IS 'Returns count of RLS policies in public schema. Used by assessment-report edge function.';

-- Grant execute to service_role (used by edge functions)
GRANT EXECUTE ON FUNCTION public.get_rls_policy_count() TO service_role;

-- ============================================================================
-- get_migration_count: Returns the number of applied migrations
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_migration_count()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM supabase_migrations.schema_migrations;
$$;

COMMENT ON FUNCTION public.get_migration_count()
  IS 'Returns count of applied Supabase migrations. Used by assessment-report edge function.';

-- Grant execute to service_role (used by edge functions)
GRANT EXECUTE ON FUNCTION public.get_migration_count() TO service_role;
