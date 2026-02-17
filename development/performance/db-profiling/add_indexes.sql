-- Performance Testing: Add Database Indexes
-- Run this script to add missing indexes for optimal query performance

-- ============================================================================
-- Devices Table Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_devices_organization_id ON devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_devices_name ON devices(name);
CREATE INDEX IF NOT EXISTS idx_devices_online_status ON devices(online_status);
CREATE INDEX IF NOT EXISTS idx_devices_device_type ON devices(device_type);
CREATE INDEX IF NOT EXISTS idx_devices_created_at ON devices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_battery_percent ON devices(battery_percent);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_devices_org_online ON devices(organization_id, online_status);
CREATE INDEX IF NOT EXISTS idx_devices_org_type ON devices(organization_id, device_type);

-- ============================================================================
-- Alerts Table Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_alerts_organization_id ON alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged_at ON alerts(acknowledged_at);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);

-- Composite index for unacknowledged alerts by organization
CREATE INDEX IF NOT EXISTS idx_alerts_unack_org 
  ON alerts(organization_id, acknowledged_at) 
  WHERE acknowledged_at IS NULL;

-- Composite index for critical unacknowledged alerts
CREATE INDEX IF NOT EXISTS idx_alerts_critical_unack 
  ON alerts(organization_id, severity, acknowledged_at) 
  WHERE severity = 'critical' AND acknowledged_at IS NULL;

-- ============================================================================
-- Device Telemetry History Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_telemetry_device_id ON device_telemetry_history(device_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON device_telemetry_history(created_at DESC);

-- Composite index for device + time range queries
CREATE INDEX IF NOT EXISTS idx_telemetry_device_created 
  ON device_telemetry_history(device_id, created_at DESC);

-- ============================================================================
-- User Actions Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_actions_user_id ON user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_device_id ON user_actions(device_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_category ON user_actions(action_category);
CREATE INDEX IF NOT EXISTS idx_user_actions_created_at ON user_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_actions_org_id ON user_actions(organization_id);

-- ============================================================================
-- Alert Acknowledgements Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_alert_ack_alert_id ON alert_acknowledgements(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_ack_user_id ON alert_acknowledgements(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_ack_created_at ON alert_acknowledgements(acknowledged_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_ack_org_id ON alert_acknowledgements(organization_id);

-- ============================================================================
-- Sensor Thresholds Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_device_id ON sensor_thresholds(device_id);
CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_org_id ON sensor_thresholds(organization_id);

-- Index for enabled thresholds only
CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_enabled 
  ON sensor_thresholds(enabled) 
  WHERE enabled = true;

-- ============================================================================
-- AI Insights Cache Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ai_cache_device_id ON ai_insights_cache(device_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires_at ON ai_insights_cache(expires_at);

-- Index for non-expired cache entries
CREATE INDEX IF NOT EXISTS idx_ai_cache_valid 
  ON ai_insights_cache(device_id, expires_at) 
  WHERE expires_at > NOW();

-- ============================================================================
-- Organization Members Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role);

-- ============================================================================
-- Analyze Tables After Index Creation
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
-- Verify Index Creation
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
