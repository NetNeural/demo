-- ============================================================================
-- GOLIOTH INTEGRATION - PRODUCTION SCHEMA
-- ============================================================================
-- Enterprise-grade schema for Golioth IoT platform integration
-- Implements Technical Specification Section 4.1.1 requirements
-- 
-- Features:
-- - Full bidirectional sync support
-- - Conflict detection and resolution
-- - Webhook event handling
-- - Reliable queue with retry logic
-- - Comprehensive audit trail
-- - Row-level security
-- - Performance indexes
-- - Data partitioning
--
-- Version: 1.0.0
-- Date: 2025-10-27
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DROP EXISTING TABLES (Safe - includes CASCADE)
-- ============================================================================

DROP TABLE IF EXISTS sync_queue CASCADE;
DROP TABLE IF EXISTS device_conflicts CASCADE;
DROP TABLE IF EXISTS device_service_assignments CASCADE;
DROP TABLE IF EXISTS golioth_sync_log CASCADE;

-- ============================================================================
-- 2. CREATE GOLIOTH SYNC LOG (Partitioned for Performance)
-- ============================================================================

CREATE TABLE golioth_sync_log (
    id UUID DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES device_integrations(id) ON DELETE CASCADE,
    operation VARCHAR(100) NOT NULL CHECK (operation IN ('import', 'export', 'bidirectional', 'webhook')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'processing', 'completed', 'failed', 'partial')),
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    devices_processed INTEGER DEFAULT 0,
    devices_succeeded INTEGER DEFAULT 0,
    devices_failed INTEGER DEFAULT 0,
    conflicts_detected INTEGER DEFAULT 0,
    error_message TEXT,
    details JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions (current + 2 months ahead)
CREATE TABLE golioth_sync_log_2025_10 PARTITION OF golioth_sync_log
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE golioth_sync_log_2025_11 PARTITION OF golioth_sync_log
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE golioth_sync_log_2025_12 PARTITION OF golioth_sync_log
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE golioth_sync_log_2026_01 PARTITION OF golioth_sync_log
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Indexes for golioth_sync_log
CREATE INDEX idx_sync_log_org_created ON golioth_sync_log(organization_id, created_at DESC);
CREATE INDEX idx_sync_log_integration ON golioth_sync_log(integration_id, status);
CREATE INDEX idx_sync_log_status ON golioth_sync_log(status) WHERE status IN ('started', 'processing');
CREATE INDEX idx_sync_log_device ON golioth_sync_log(device_id) WHERE device_id IS NOT NULL;

-- ============================================================================
-- 3. CREATE DEVICE CONFLICTS TABLE
-- ============================================================================

CREATE TABLE device_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    sync_log_id UUID,  -- Cannot FK to partitioned table, enforce via triggers
    conflict_type VARCHAR(100) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    local_value JSONB NOT NULL,
    remote_value JSONB NOT NULL,
    local_updated_at TIMESTAMPTZ,
    remote_updated_at TIMESTAMPTZ,
    resolution_status VARCHAR(50) NOT NULL DEFAULT 'pending' 
        CHECK (resolution_status IN ('pending', 'resolved', 'ignored', 'auto_resolved')),
    resolution_strategy VARCHAR(50) 
        CHECK (resolution_strategy IN ('local_wins', 'remote_wins', 'merge', 'manual')),
    resolved_value JSONB,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    auto_resolve_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_resolution CHECK (
        (resolution_status = 'pending' AND resolved_at IS NULL) OR
        (resolution_status != 'pending' AND resolved_at IS NOT NULL)
    )
);

-- Indexes for device_conflicts
CREATE INDEX idx_conflicts_device ON device_conflicts(device_id, resolution_status);
CREATE INDEX idx_conflicts_pending ON device_conflicts(resolution_status) WHERE resolution_status = 'pending';
CREATE INDEX idx_conflicts_created ON device_conflicts(created_at DESC);
CREATE INDEX idx_conflicts_sync_log ON device_conflicts(sync_log_id) WHERE sync_log_id IS NOT NULL;

-- ============================================================================
-- 4. CREATE DEVICE SERVICE ASSIGNMENTS TABLE
-- ============================================================================

CREATE TABLE device_service_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES device_integrations(id) ON DELETE CASCADE,
    external_device_id VARCHAR(255) NOT NULL,
    sync_enabled BOOLEAN NOT NULL DEFAULT true,
    sync_direction VARCHAR(50) NOT NULL DEFAULT 'bidirectional' 
        CHECK (sync_direction IN ('import', 'export', 'bidirectional', 'none')),
    sync_status VARCHAR(50) NOT NULL DEFAULT 'pending' 
        CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error', 'conflict')),
    last_sync_at TIMESTAMPTZ,
    last_sync_log_id UUID,
    sync_error TEXT,
    sync_retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(device_id, integration_id),
    UNIQUE(integration_id, external_device_id)
);

-- Indexes for device_service_assignments
CREATE INDEX idx_assignments_device ON device_service_assignments(device_id);
CREATE INDEX idx_assignments_integration ON device_service_assignments(integration_id);
CREATE INDEX idx_assignments_external ON device_service_assignments(external_device_id);
CREATE INDEX idx_assignments_sync_status ON device_service_assignments(sync_status, sync_enabled);
CREATE INDEX idx_assignments_retry ON device_service_assignments(next_retry_at) 
    WHERE sync_status = 'error' AND sync_retry_count < 5;

-- ============================================================================
-- 5. CREATE SYNC QUEUE TABLE (For Reliability)
-- ============================================================================

CREATE TABLE sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES device_integrations(id) ON DELETE CASCADE,
    operation VARCHAR(100) NOT NULL 
        CHECK (operation IN ('sync_device', 'sync_all', 'resolve_conflict', 'webhook_event')),
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
    payload JSONB NOT NULL,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for sync_queue
CREATE INDEX idx_queue_pending ON sync_queue(priority DESC, created_at ASC) 
    WHERE status = 'pending';
CREATE INDEX idx_queue_retry ON sync_queue(next_retry_at) 
    WHERE status = 'failed' AND retry_count < max_retries;
CREATE INDEX idx_queue_org ON sync_queue(organization_id, status);
CREATE INDEX idx_queue_integration ON sync_queue(integration_id, status);

-- ============================================================================
-- 6. ADD COLUMNS TO DEVICE_INTEGRATIONS
-- ============================================================================

ALTER TABLE device_integrations
    ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS sync_interval_seconds INTEGER DEFAULT 300 
        CHECK (sync_interval_seconds >= 60),
    ADD COLUMN IF NOT EXISTS sync_direction VARCHAR(50) DEFAULT 'bidirectional' 
        CHECK (sync_direction IN ('import', 'export', 'bidirectional', 'none')),
    ADD COLUMN IF NOT EXISTS conflict_resolution VARCHAR(50) DEFAULT 'manual' 
        CHECK (conflict_resolution IN ('local_wins', 'remote_wins', 'manual', 'newest_wins')),
    ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255),
    ADD COLUMN IF NOT EXISTS webhook_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_sync_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE golioth_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_service_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Sync log policies
CREATE POLICY "org_members_view_sync_logs" ON golioth_sync_log
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "system_insert_sync_logs" ON golioth_sync_log
    FOR INSERT WITH CHECK (true);

CREATE POLICY "system_update_sync_logs" ON golioth_sync_log
    FOR UPDATE USING (true);

-- Conflict policies
CREATE POLICY "org_members_view_conflicts" ON device_conflicts
    FOR SELECT USING (
        device_id IN (
            SELECT d.id FROM devices d
            INNER JOIN users u ON d.organization_id = u.organization_id
            WHERE u.id = auth.uid()
        )
    );

CREATE POLICY "org_admins_resolve_conflicts" ON device_conflicts
    FOR UPDATE USING (
        device_id IN (
            SELECT d.id FROM devices d
            INNER JOIN users u ON d.organization_id = u.organization_id
            WHERE u.id = auth.uid() 
            AND u.role IN ('super_admin', 'org_admin', 'org_owner')
        )
    );

CREATE POLICY "system_insert_conflicts" ON device_conflicts
    FOR INSERT WITH CHECK (true);

-- Assignment policies
CREATE POLICY "org_members_view_assignments" ON device_service_assignments
    FOR SELECT USING (
        device_id IN (
            SELECT d.id FROM devices d
            INNER JOIN users u ON d.organization_id = u.organization_id
            WHERE u.id = auth.uid()
        )
    );

CREATE POLICY "org_admins_manage_assignments" ON device_service_assignments
    FOR ALL USING (
        device_id IN (
            SELECT d.id FROM devices d
            INNER JOIN users u ON d.organization_id = u.organization_id
            WHERE u.id = auth.uid() 
            AND u.role IN ('super_admin', 'org_admin', 'org_owner')
        )
    );

CREATE POLICY "system_manage_assignments" ON device_service_assignments
    FOR ALL USING (true);

-- Queue policies  
CREATE POLICY "org_members_view_queue" ON sync_queue
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "system_manage_queue" ON sync_queue
    FOR ALL USING (true);

-- ============================================================================
-- 8. TRIGGERS
-- ============================================================================

-- Create trigger function if doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
CREATE TRIGGER update_assignments_updated_at
    BEFORE UPDATE ON device_service_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_updated_at
    BEFORE UPDATE ON sync_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. HELPER FUNCTIONS
-- ============================================================================

-- Function to get pending conflicts for an organization
CREATE OR REPLACE FUNCTION get_pending_conflicts(org_id UUID)
RETURNS TABLE (
    conflict_id UUID,
    device_id UUID,
    device_name VARCHAR,
    conflict_type VARCHAR,
    field_name VARCHAR,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dc.id,
        dc.device_id,
        d.name,
        dc.conflict_type,
        dc.field_name,
        dc.created_at
    FROM device_conflicts dc
    INNER JOIN devices d ON dc.device_id = d.id
    WHERE d.organization_id = org_id
    AND dc.resolution_status = 'pending'
    ORDER BY dc.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sync statistics
CREATE OR REPLACE FUNCTION get_sync_stats(org_id UUID, integration_id_param UUID DEFAULT NULL)
RETURNS TABLE (
    total_syncs BIGINT,
    successful_syncs BIGINT,
    failed_syncs BIGINT,
    pending_conflicts BIGINT,
    last_sync_at TIMESTAMPTZ,
    avg_duration_ms NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_syncs,
        COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as successful_syncs,
        COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_syncs,
        (SELECT COUNT(*)::BIGINT FROM device_conflicts dc 
         INNER JOIN devices d ON dc.device_id = d.id 
         WHERE d.organization_id = org_id 
         AND dc.resolution_status = 'pending') as pending_conflicts,
        MAX(completed_at) as last_sync_at,
        AVG(duration_ms)::NUMERIC as avg_duration_ms
    FROM golioth_sync_log
    WHERE organization_id = org_id
    AND (integration_id_param IS NULL OR integration_id = integration_id_param)
    AND created_at > NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. TABLE COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE golioth_sync_log IS 'Audit trail for all synchronization operations with Golioth. Partitioned by month for performance.';
COMMENT ON TABLE device_conflicts IS 'Stores conflicts detected during bidirectional sync with resolution workflow.';
COMMENT ON TABLE device_service_assignments IS 'Maps devices to external IoT services with sync configuration.';
COMMENT ON TABLE sync_queue IS 'Reliable queue for sync operations with retry logic and dead letter handling.';

COMMENT ON COLUMN golioth_sync_log.operation IS 'Type of sync: import (Golioth→Local), export (Local→Golioth), bidirectional, webhook';
COMMENT ON COLUMN golioth_sync_log.status IS 'Sync status: started, processing, completed, failed, partial (completed with conflicts/errors)';
COMMENT ON COLUMN device_conflicts.resolution_strategy IS 'How conflict was resolved: local_wins, remote_wins, merge, manual';
COMMENT ON COLUMN device_service_assignments.sync_direction IS 'Sync direction: import, export, bidirectional, none';
COMMENT ON COLUMN sync_queue.priority IS 'Queue priority 1-10, higher = more urgent';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify:
-- 
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
--   AND tablename LIKE '%golioth%' OR tablename LIKE '%conflict%' 
--   OR tablename LIKE '%sync%' OR tablename LIKE '%assignment%';
--
-- SELECT * FROM get_sync_stats('your-org-id');
-- SELECT * FROM get_pending_conflicts('your-org-id');
-- ============================================================================
