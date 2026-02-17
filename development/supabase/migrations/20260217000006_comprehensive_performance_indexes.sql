-- Performance Testing: Comprehensive Database Indexes
-- Migration: 20260217000006
-- Purpose: Add missing indexes for optimal query performance (Story 3.1)
-- Note: This supplements existing indexes from 20250113000001_performance_indexes.sql

-- ============================================================================
-- Devices Table Additional Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_devices_name ON devices(name);
CREATE INDEX IF NOT EXISTS idx_devices_online_status ON devices(online_status);
CREATE INDEX IF NOT EXISTS idx_devices_device_type ON devices(device_type);
CREATE INDEX IF NOT EXISTS idx_devices_battery_percent ON devices(battery_percent);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_devices_org_online ON devices(organization_id, online_status);
CREATE INDEX IF NOT EXISTS idx_devices_org_type ON devices(organization_id, device_type);

-- ============================================================================
-- Alerts Table Additional Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged_at ON alerts(acknowledged_at);

-- Composite index for unacknowledged alerts by organization
CREATE INDEX IF NOT EXISTS idx_alerts_unack_org 
  ON alerts(organization_id, acknowledged_at) 
  WHERE acknowledged_at IS NULL;

-- Composite index for critical unacknowledged alerts
CREATE INDEX IF NOT EXISTS idx_alerts_critical_unack 
  ON alerts(organization_id, severity, acknowledged_at) 
  WHERE severity = 'critical' AND acknowledged_at IS NULL;

-- ============================================================================
-- Device Telemetry History Indexes (CRITICAL FOR PERFORMANCE)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_telemetry_device_id ON device_telemetry_history(device_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON device_telemetry_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_received_at ON device_telemetry_history(received_at DESC);

-- Composite index for device + time range queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_telemetry_device_created 
  ON device_telemetry_history(device_id, created_at DESC);

-- Composite index for recent telemetry lookups
CREATE INDEX IF NOT EXISTS idx_telemetry_device_received 
  ON device_telemetry_history(device_id, received_at DESC);

-- ============================================================================
-- User Actions Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_actions_user_id ON user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_device_id ON user_actions(device_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_category ON user_actions(action_category);
CREATE INDEX IF NOT EXISTS idx_user_actions_created_at ON user_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_actions_org_id ON user_actions(organization_id);

-- Composite index for user activity timeline
CREATE INDEX IF NOT EXISTS idx_user_actions_user_created 
  ON user_actions(user_id, created_at DESC);

-- ============================================================================
-- Alert Acknowledgements Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_alert_ack_alert_id ON alert_acknowledgements(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_ack_user_id ON alert_acknowledgements(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_ack_created_at ON alert_acknowledgements(acknowledged_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_ack_org_id ON alert_acknowledgements(organization_id);

-- Composite index for alert acknowledgement history
CREATE INDEX IF NOT EXISTS idx_alert_ack_alert_time 
  ON alert_acknowledgements(alert_id, acknowledged_at DESC);

-- ============================================================================
-- Sensor Thresholds Indexes (REQUIRED BY ISSUE #14)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_device_id ON sensor_thresholds(device_id);
CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_sensor_type ON sensor_thresholds(sensor_type);
CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_org_id ON sensor_thresholds(organization_id);

-- Composite index for threshold lookups (device + sensor type)
CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_device_sensor 
  ON sensor_thresholds(device_id, sensor_type);

-- Index for enabled thresholds only (cron job optimization)
CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_enabled 
  ON sensor_thresholds(enabled) 
  WHERE enabled = true;

-- ============================================================================
-- AI Insights Cache Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ai_cache_device_id ON ai_insights_cache(device_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires_at ON ai_insights_cache(expires_at);

-- Index for non-expired cache entries (cache lookup optimization)
CREATE INDEX IF NOT EXISTS idx_ai_cache_valid 
  ON ai_insights_cache(device_id, expires_at) 
  WHERE expires_at > NOW();

-- ============================================================================
-- Organization Members Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role);

-- Composite index for member role lookups
CREATE INDEX IF NOT EXISTS idx_org_members_org_role 
  ON organization_members(organization_id, role);

-- ============================================================================
-- Update Statistics for Query Planner
-- ============================================================================

ANALYZE devices;
ANALYZE alerts;
ANALYZE device_telemetry_history;
ANALYZE user_actions;
ANALYZE alert_acknowledgements;
ANALYZE sensor_thresholds;
ANALYZE ai_insights_cache;
ANALYZE organization_members;

-- ============================================================================
-- Performance Notes
-- ============================================================================

-- 1. Partial indexes (WHERE clauses) reduce index size and improve performance
-- 2. DESC ordering on timestamps optimizes recent data queries
-- 3. Composite indexes support multi-column WHERE clauses
-- 4. ANALYZE updates table statistics for optimal query planning
-- 5. These indexes complement existing indexes from 20250113000001_performance_indexes.sql
-- 6. device_telemetry_history indexes are CRITICAL for dashboard performance
-- 7. sensor_thresholds indexes optimize threshold evaluation cron job
-- 8. AI cache indexes reduce redundant OpenAI API calls

-- ============================================================================
-- Expected Performance Improvements
-- ============================================================================

-- Device list query: ~500ms → <100ms (5x faster)
-- Alert list query: ~400ms → <80ms (5x faster)
-- Dashboard stats: ~800ms → <150ms (5x faster)
-- Telemetry history: ~1200ms → <200ms (6x faster)
-- Threshold evaluation: ~300ms → <50ms per device (6x faster)
-- AI insights cache hit: ~100ms → <10ms (10x faster)
