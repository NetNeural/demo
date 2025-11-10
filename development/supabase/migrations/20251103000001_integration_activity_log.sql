-- ============================================================================
-- INTEGRATION ACTIVITY LOG
-- ============================================================================
-- Comprehensive logging for ALL integration activity
-- Tracks both outgoing calls (tests, syncs) and incoming calls (webhooks)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE INTEGRATION_ACTIVITY_LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES device_integrations(id) ON DELETE CASCADE,
    
    -- Activity classification
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('outgoing', 'incoming')),
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
        'test_connection',
        'sync_import',
        'sync_export',
        'sync_bidirectional',
        'webhook_received',
        'notification_email',
        'notification_slack',
        'notification_webhook',
        'api_call',
        'device_create',
        'device_update',
        'device_delete',
        -- MQTT-specific activity types
        'mqtt_message_received',
        'mqtt_device_discovered',
        'mqtt_device_online',
        'mqtt_device_offline',
        'mqtt_connection_established',
        'mqtt_connection_lost',
        'mqtt_subscription_created',
        'mqtt_publish_success',
        'mqtt_publish_failed',
        'other'
    )),
    
    -- Request/Response data
    method VARCHAR(10), -- GET, POST, PUT, DELETE, etc.
    endpoint TEXT,
    request_headers JSONB DEFAULT '{}',
    request_body JSONB,
    response_status INTEGER,
    response_body JSONB,
    response_time_ms INTEGER,
    
    -- Status and error tracking
    status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'success', 'failed', 'timeout', 'error')),
    error_message TEXT,
    error_code VARCHAR(50),
    
    -- Additional metadata
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

-- Primary query patterns
CREATE INDEX idx_activity_log_org_created ON integration_activity_log(organization_id, created_at DESC);
CREATE INDEX idx_activity_log_integration_created ON integration_activity_log(integration_id, created_at DESC);
CREATE INDEX idx_activity_log_type ON integration_activity_log(activity_type, status);
CREATE INDEX idx_activity_log_direction ON integration_activity_log(direction, status);
CREATE INDEX idx_activity_log_status ON integration_activity_log(status, created_at DESC);

-- Performance optimization for failed activities
CREATE INDEX idx_activity_log_failed ON integration_activity_log(organization_id, created_at DESC) 
    WHERE status IN ('failed', 'error', 'timeout');

-- User activity tracking
CREATE INDEX idx_activity_log_user ON integration_activity_log(user_id, created_at DESC) 
    WHERE user_id IS NOT NULL;

-- ============================================================================
-- 3. CREATE HELPER FUNCTION FOR LOGGING
-- ============================================================================

CREATE OR REPLACE FUNCTION log_integration_activity(
    p_organization_id UUID,
    p_integration_id UUID,
    p_direction VARCHAR,
    p_activity_type VARCHAR,
    p_method VARCHAR DEFAULT NULL,
    p_endpoint TEXT DEFAULT NULL,
    p_status VARCHAR DEFAULT 'started',
    p_user_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO integration_activity_log (
        organization_id,
        integration_id,
        direction,
        activity_type,
        method,
        endpoint,
        status,
        user_id,
        metadata
    ) VALUES (
        p_organization_id,
        p_integration_id,
        p_direction,
        p_activity_type,
        p_method,
        p_endpoint,
        p_status,
        p_user_id,
        p_metadata
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. CREATE HELPER FUNCTION FOR COMPLETING LOGS
-- ============================================================================

CREATE OR REPLACE FUNCTION complete_integration_activity(
    p_log_id UUID,
    p_status VARCHAR,
    p_response_status INTEGER DEFAULT NULL,
    p_response_body JSONB DEFAULT NULL,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_error_code VARCHAR DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE integration_activity_log
    SET 
        status = p_status,
        response_status = p_response_status,
        response_body = p_response_body,
        response_time_ms = p_response_time_ms,
        error_message = p_error_message,
        error_code = p_error_code,
        completed_at = NOW()
    WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. CREATE VIEW FOR INTEGRATION ACTIVITY SUMMARY
-- ============================================================================

CREATE OR REPLACE VIEW integration_activity_summary AS
SELECT 
    integration_id,
    organization_id,
    direction,
    activity_type,
    status,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE status = 'success') as success_count,
    COUNT(*) FILTER (WHERE status IN ('failed', 'error', 'timeout')) as error_count,
    AVG(response_time_ms) FILTER (WHERE response_time_ms IS NOT NULL) as avg_response_time_ms,
    MAX(created_at) as last_activity_at,
    DATE_TRUNC('day', created_at) as activity_date
FROM integration_activity_log
GROUP BY integration_id, organization_id, direction, activity_type, status, DATE_TRUNC('day', created_at);

-- ============================================================================
-- 6. CREATE RLS POLICIES
-- ============================================================================

ALTER TABLE integration_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can view activity logs for their organization's integrations
CREATE POLICY "org_members_view_integration_activity" ON integration_activity_log
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- System/service role can manage all logs
CREATE POLICY "service_manage_integration_activity" ON integration_activity_log
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- ============================================================================
-- 7. CREATE CLEANUP FUNCTION (Delete logs older than 90 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_integration_logs() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM integration_activity_log
    WHERE created_at < NOW() - INTERVAL '90 days'
    RETURNING COUNT(*) INTO deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. COMMENTS
-- ============================================================================

COMMENT ON TABLE integration_activity_log IS 'Comprehensive activity log for all integration operations (outgoing and incoming)';
COMMENT ON COLUMN integration_activity_log.direction IS 'outgoing = calls made by our system, incoming = calls received by our system';
COMMENT ON COLUMN integration_activity_log.activity_type IS 'Type of activity: test, sync, webhook, notification, etc.';
COMMENT ON COLUMN integration_activity_log.response_time_ms IS 'Time taken to complete the activity in milliseconds';
COMMENT ON FUNCTION log_integration_activity IS 'Helper function to create a new activity log entry';
COMMENT ON FUNCTION complete_integration_activity IS 'Helper function to update activity log with completion details';
COMMENT ON FUNCTION cleanup_old_integration_logs IS 'Removes activity logs older than 90 days for storage optimization';

COMMIT;
