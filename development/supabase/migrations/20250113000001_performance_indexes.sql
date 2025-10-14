-- Performance Indexes Migration
-- Created: 2025-01-13
-- Purpose: Add indexes to optimize common query patterns and improve performance
-- Note: CONCURRENTLY removed because migrations run in transactions

-- ============================================================================
-- Time-series data indexes
-- ============================================================================

-- Index for device data queries (time-series lookups by device)
CREATE INDEX IF NOT EXISTS idx_device_data_device_timestamp 
  ON device_data(device_id, timestamp DESC);

-- Index for device data by sensor type (for analytics)
CREATE INDEX IF NOT EXISTS idx_device_data_sensor_type 
  ON device_data(sensor_type, timestamp DESC);

-- ============================================================================
-- Organization-scoped queries (most common access pattern)
-- ============================================================================

-- Devices by organization and status (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_devices_org_status 
  ON devices(organization_id, status) 
  WHERE status IS NOT NULL;

-- Devices by organization and last seen (monitoring queries)
CREATE INDEX IF NOT EXISTS idx_devices_org_last_seen 
  ON devices(organization_id, last_seen DESC);

-- Alerts by organization and creation time (alert list queries)
CREATE INDEX IF NOT EXISTS idx_alerts_org_created 
  ON alerts(organization_id, created_at DESC);

-- Unresolved alerts by organization (dashboard critical queries)
CREATE INDEX IF NOT EXISTS idx_alerts_org_unresolved 
  ON alerts(organization_id, severity DESC, created_at DESC) 
  WHERE is_resolved = false;

-- Users by organization and role (permission checks)
CREATE INDEX IF NOT EXISTS idx_users_org_role 
  ON users(organization_id, role) 
  WHERE is_active = true;

-- Locations by organization (location lookups)
CREATE INDEX IF NOT EXISTS idx_locations_org 
  ON locations(organization_id);

-- Device integrations by organization (integration lookups)
CREATE INDEX IF NOT EXISTS idx_device_integrations_org_status 
  ON device_integrations(organization_id, status);

-- ============================================================================
-- Foreign key relationship indexes
-- ============================================================================

-- Devices by integration (for sync operations)
CREATE INDEX IF NOT EXISTS idx_devices_integration 
  ON devices(integration_id) 
  WHERE integration_id IS NOT NULL;

-- Devices by location (location-based queries)
CREATE INDEX IF NOT EXISTS idx_devices_location 
  ON devices(location_id) 
  WHERE location_id IS NOT NULL;

-- Devices by department (department-based queries)
CREATE INDEX IF NOT EXISTS idx_devices_department 
  ON devices(department_id) 
  WHERE department_id IS NOT NULL;

-- Departments by location (hierarchy lookups)
CREATE INDEX IF NOT EXISTS idx_departments_location 
  ON departments(location_id);

-- Alerts by device (device detail page queries)
CREATE INDEX IF NOT EXISTS idx_alerts_device_created 
  ON alerts(device_id, created_at DESC) 
  WHERE device_id IS NOT NULL;

-- ============================================================================
-- Notification and audit indexes
-- ============================================================================

-- Notifications by recipient and creation time (user notification queries)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created 
  ON notifications(recipient_id, created_at DESC);

-- Pending notifications by method (notification processing)
CREATE INDEX IF NOT EXISTS idx_notifications_pending 
  ON notifications(method, created_at) 
  WHERE status = 'pending';

-- Audit logs by organization and timestamp (audit trail queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_timestamp 
  ON audit_logs(organization_id, created_at DESC);

-- Audit logs by user (user activity tracking)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp 
  ON audit_logs(user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

-- ============================================================================
-- Search and lookup indexes
-- ============================================================================

-- Organizations by slug (URL lookups)
CREATE INDEX IF NOT EXISTS idx_organizations_slug 
  ON organizations(slug) 
  WHERE is_active = true;

-- Users by email (login lookups)
CREATE INDEX IF NOT EXISTS idx_users_email 
  ON users(email) 
  WHERE is_active = true;

-- Devices by external ID (integration sync lookups)
CREATE INDEX IF NOT EXISTS idx_devices_external_id 
  ON devices(external_device_id) 
  WHERE external_device_id IS NOT NULL;

-- Devices by serial number (hardware lookups)
CREATE INDEX IF NOT EXISTS idx_devices_serial_number 
  ON devices(serial_number) 
  WHERE serial_number IS NOT NULL;

-- ============================================================================
-- Composite indexes for specific query patterns
-- ============================================================================

-- Device status monitoring (online/offline counts by organization)
CREATE INDEX IF NOT EXISTS idx_devices_org_status_last_seen 
  ON devices(organization_id, status, last_seen DESC);

-- Alert severity analysis (critical alerts by organization)
CREATE INDEX IF NOT EXISTS idx_alerts_org_severity_resolved 
  ON alerts(organization_id, severity, is_resolved, created_at DESC);

-- Device battery monitoring (low battery devices)
CREATE INDEX IF NOT EXISTS idx_devices_org_battery 
  ON devices(organization_id, battery_level) 
  WHERE battery_level IS NOT NULL AND battery_level < 20;

-- Device signal monitoring (weak signal devices)
CREATE INDEX IF NOT EXISTS idx_devices_org_signal 
  ON devices(organization_id, signal_strength) 
  WHERE signal_strength IS NOT NULL AND signal_strength < -70;

-- ============================================================================
-- Update statistics for query planner
-- ============================================================================

ANALYZE devices;
ANALYZE device_data;
ANALYZE alerts;
ANALYZE users;
ANALYZE organizations;
ANALYZE locations;
ANALYZE departments;
ANALYZE device_integrations;
ANALYZE notifications;
ANALYZE audit_logs;

-- ============================================================================
-- Performance notes
-- ============================================================================

-- 1. CONCURRENTLY removed because migrations run within transactions
-- 2. Partial indexes (WHERE clauses) reduce index size and improve performance
-- 3. DESC ordering on timestamps optimizes recent data queries
-- 4. Composite indexes support multi-column WHERE clauses
-- 5. ANALYZE updates table statistics for optimal query planning
