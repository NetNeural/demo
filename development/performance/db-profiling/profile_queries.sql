-- Performance Testing: Database Query Profiling
-- Run these queries to identify performance bottlenecks

-- ============================================================================
-- 1. Enable Query Statistics Extension
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================================================
-- 2. View Slow Queries (> 100ms average)
-- ============================================================================

SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  min_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;

-- ============================================================================
-- 3. Profile Device List Query
-- ============================================================================

EXPLAIN ANALYZE
SELECT 
  d.*,
  COUNT(a.id) as alert_count
FROM devices d
LEFT JOIN alerts a ON a.device_id = d.id AND a.acknowledged_at IS NULL
WHERE d.organization_id = 'test-org-123'
GROUP BY d.id
ORDER BY d.name ASC
LIMIT 200;

-- ============================================================================
-- 4. Profile Alert List Query
-- ============================================================================

EXPLAIN ANALYZE
SELECT 
  a.*,
  d.name as device_name,
  d.device_type
FROM alerts a
INNER JOIN devices d ON d.id = a.device_id
WHERE a.organization_id = 'test-org-123'
ORDER BY a.created_at DESC
LIMIT 100;

-- ============================================================================
-- 5. Profile Telemetry History Query
-- ============================================================================

EXPLAIN ANALYZE
SELECT 
  device_id,
  temperature_f,
  humidity,
  battery_percent,
  created_at
FROM device_telemetry_history
WHERE device_id = 'test-device-123'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- ============================================================================
-- 6. Profile Dashboard Stats Query
-- ============================================================================

EXPLAIN ANALYZE
SELECT 
  (SELECT COUNT(*) FROM devices WHERE organization_id = 'test-org-123' AND online_status = 'online') as online_devices,
  (SELECT COUNT(*) FROM devices WHERE organization_id = 'test-org-123') as total_devices,
  (SELECT COUNT(*) FROM alerts WHERE organization_id = 'test-org-123' AND acknowledged_at IS NULL) as unack_alerts,
  (SELECT COUNT(*) FROM alerts WHERE organization_id = 'test-org-123' AND severity = 'critical' AND acknowledged_at IS NULL) as critical_alerts;

-- ============================================================================
-- 7. Check Index Usage
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- ============================================================================
-- 8. Check Table Stats
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;

-- ============================================================================
-- 9. Find Missing Indexes
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1
ORDER BY n_distinct DESC;

-- ============================================================================
-- 10. Check Cache Hit Ratio
-- ============================================================================

SELECT 
  'cache hit rate' AS metric,
  ROUND(100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS percentage
FROM pg_statio_user_tables;

-- ============================================================================
-- 11. Reset Statistics
-- ============================================================================

-- Run this to reset profiling stats and start fresh
-- SELECT pg_stat_statements_reset();
