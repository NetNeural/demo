-- Performance Configuration: Database Settings
-- Migration: 20260217000007
-- Purpose: Configure PostgreSQL performance parameters (Story 3.1)
-- Note: Sets statement timeout, work_mem, and other performance settings

-- ============================================================================
-- Set Statement Timeout (30 seconds)
-- ============================================================================

-- Prevent runaway queries from consuming resources
-- applies to all users and sessions in this database
ALTER DATABASE postgres SET statement_timeout = '30s';

-- ============================================================================
-- Configure Work Memory
-- ============================================================================

-- Increase work_mem for complex queries (sorting, hashing)
-- Default is 4MB, increasing to 16MB for better performance
-- Note: This is per operation, not per query
ALTER DATABASE postgres SET work_mem = '16MB';

-- ============================================================================
-- Configure Shared Buffers (if not already set by Supabase)
-- ============================================================================

-- These settings are typically managed by Supabase
-- Documented here for reference in case of self-hosted deployment

-- shared_buffers: 25% of RAM (set in postgresql.conf or Supabase config)
-- effective_cache_size: 50-75% of RAM (helps query planner)
-- maintenance_work_mem: 256MB-1GB (for VACUUM, CREATE INDEX, etc.)

-- ============================================================================
-- Configure Query Planner Settings
-- ============================================================================

-- Enable efficient use of indexes
ALTER DATABASE postgres SET random_page_cost = '1.1';  -- Lower for SSD storage
ALTER DATABASE postgres SET effective_cache_size = '4GB';  -- Adjust based on available RAM

-- ============================================================================
-- Configure Autovacuum (Important for Write-Heavy Workloads)
-- ============================================================================

-- More aggressive autovacuum for better performance
-- These apply to all tables in the database
ALTER DATABASE postgres SET autovacuum_analyze_scale_factor = '0.05';  -- Analyze after 5% change
ALTER DATABASE postgres SET autovacuum_vacuum_scale_factor = '0.1';    -- Vacuum after 10% change

-- ============================================================================
-- Enable Query Statistics Extension (for monitoring)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================================================
-- Create View for Easy Query Performance Monitoring
-- ============================================================================

CREATE OR REPLACE VIEW slow_queries AS
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  min_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- Queries slower than 100ms
ORDER BY mean_exec_time DESC
LIMIT 50;

COMMENT ON VIEW slow_queries IS 'View for monitoring slow database queries (> 100ms average)';

-- ============================================================================
-- Create View for Index Usage Statistics
-- ============================================================================

CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  CASE 
    WHEN idx_scan = 0 THEN 'UNUSED'
    WHEN idx_scan < 100 THEN 'LOW_USAGE'
    WHEN idx_scan < 1000 THEN 'MODERATE_USAGE'
    ELSE 'HIGH_USAGE'
  END AS usage_category
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

COMMENT ON VIEW index_usage_stats IS 'View for monitoring database index usage and identifying unused indexes';

-- ============================================================================
-- Create View for Table Bloat Monitoring
-- ============================================================================

CREATE OR REPLACE VIEW table_bloat_stats AS
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  n_live_tup,
  n_dead_tup,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_pct,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC;

COMMENT ON VIEW table_bloat_stats IS 'View for monitoring table bloat and vacuum activity';

-- ============================================================================
-- Create View for Connection Pool Monitoring
-- ============================================================================

CREATE OR REPLACE VIEW connection_stats AS
SELECT 
  datname,
  numbackends AS active_connections,
  xact_commit AS transactions_committed,
  xact_rollback AS transactions_rolled_back,
  blks_read AS disk_blocks_read,
  blks_hit AS cache_blocks_hit,
  ROUND(100.0 * blks_hit / NULLIF(blks_read + blks_hit, 0), 2) AS cache_hit_ratio,
  tup_returned,
  tup_fetched,
  tup_inserted,
  tup_updated,
  tup_deleted
FROM pg_stat_database
WHERE datname = current_database();

COMMENT ON VIEW connection_stats IS 'View for monitoring database connection statistics and cache performance';

-- ============================================================================
-- Create Function to Reset Query Statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_query_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reset pg_stat_statements for fresh profiling
  SELECT pg_stat_statements_reset();
  
  -- Reset table and index statistics
  SELECT pg_stat_reset();
  
  RAISE NOTICE 'Query statistics have been reset';
END;
$$;

COMMENT ON FUNCTION reset_query_stats IS 'Reset all query performance statistics for fresh profiling';

-- ============================================================================
-- Grant Permissions for Monitoring Views
-- ============================================================================

-- Allow authenticated users to see slow queries (their own organization's data)
GRANT SELECT ON slow_queries TO authenticated;
GRANT SELECT ON index_usage_stats TO authenticated;
GRANT SELECT ON table_bloat_stats TO authenticated;
GRANT SELECT ON connection_stats TO authenticated;

-- Allow service role to reset stats
GRANT EXECUTE ON FUNCTION reset_query_stats TO service_role;

-- ============================================================================
-- Performance Configuration Summary
-- ============================================================================

-- Display current performance settings
SELECT 
  'statement_timeout' AS setting,
  current_setting('statement_timeout') AS value
UNION ALL
SELECT 'work_mem', current_setting('work_mem')
UNION ALL
SELECT 'random_page_cost', current_setting('random_page_cost')
UNION ALL
SELECT 'effective_cache_size', current_setting('effective_cache_size')
UNION ALL
SELECT 'autovacuum_analyze_scale_factor', current_setting('autovacuum_analyze_scale_factor')
UNION ALL
SELECT 'autovacuum_vacuum_scale_factor', current_setting('autovacuum_vacuum_scale_factor');

-- ============================================================================
-- Notes
-- ============================================================================

-- 1. statement_timeout prevents queries from running indefinitely
-- 2. work_mem affects sorting and hashing performance
-- 3. random_page_cost should be lower for SSD storage (1.0-1.5)
-- 4. effective_cache_size helps query planner make better decisions
-- 5. Autovacuum settings keep tables lean and performant
-- 6. pg_stat_statements enables detailed query monitoring
-- 7. Monitoring views provide easy access to performance metrics
-- 8. All queries should complete under 500ms (95th percentile target)
