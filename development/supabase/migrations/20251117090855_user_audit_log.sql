-- ============================================================================
-- USER AUDIT LOG - Comprehensive System Activity Tracking
-- ============================================================================
-- Tracks ALL user actions that modify system state:
-- - Authentication (login, logout, password changes)
-- - Resource CRUD (create, update, delete)
-- - Alert acknowledgements
-- - Configuration changes
-- - Data imports/exports
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE USER_AUDIT_LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who: User identification
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- What: Action details
    action_category VARCHAR(50) NOT NULL CHECK (action_category IN (
        'authentication',
        'device_management',
        'integration_management',
        'alert_management',
        'user_management',
        'organization_management',
        'configuration',
        'data_import_export',
        'webhook',
        'mqtt',
        'notification',
        'other'
    )),
    
    action_type VARCHAR(100) NOT NULL,
    -- Examples: 'login', 'logout', 'device_create', 'device_update', 'device_delete',
    --           'integration_create', 'alert_acknowledge', 'user_invite', 'settings_update'
    
    -- What was affected: Resource details
    resource_type VARCHAR(50), -- 'device', 'integration', 'alert', 'user', 'organization', etc.
    resource_id UUID, -- ID of the affected resource
    resource_name TEXT, -- Human-readable name
    
    -- How: Request details
    method VARCHAR(10), -- GET, POST, PUT, DELETE, PATCH
    endpoint TEXT, -- API endpoint or page URL
    
    -- Context: Additional data
    changes JSONB DEFAULT '{}', -- Before/after values for updates
    metadata JSONB DEFAULT '{}', -- Additional context
    
    -- Result
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'error', 'pending')),
    error_message TEXT,
    
    -- When: Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Where: Network details
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

-- Primary query patterns
CREATE INDEX idx_audit_log_user_created ON user_audit_log(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_log_org_created ON user_audit_log(organization_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON user_audit_log(action_category, action_type, created_at DESC);
CREATE INDEX idx_audit_log_resource ON user_audit_log(resource_type, resource_id) WHERE resource_id IS NOT NULL;
CREATE INDEX idx_audit_log_status ON user_audit_log(status, created_at DESC);

-- Failed actions for security monitoring
CREATE INDEX idx_audit_log_failed ON user_audit_log(action_category, created_at DESC) 
    WHERE status IN ('failed', 'error');

-- Authentication events for security analysis
CREATE INDEX idx_audit_log_auth ON user_audit_log(user_email, created_at DESC) 
    WHERE action_category = 'authentication';

-- Full-text search on action details
CREATE INDEX idx_audit_log_search ON user_audit_log USING gin(
    to_tsvector('english', COALESCE(action_type, '') || ' ' || COALESCE(resource_name, ''))
);

-- ============================================================================
-- 3. CREATE HELPER FUNCTION FOR LOGGING
-- ============================================================================

CREATE OR REPLACE FUNCTION log_user_action(
    p_user_id UUID,
    p_user_email TEXT,
    p_organization_id UUID,
    p_action_category VARCHAR,
    p_action_type VARCHAR,
    p_resource_type VARCHAR DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_resource_name TEXT DEFAULT NULL,
    p_method VARCHAR DEFAULT NULL,
    p_endpoint TEXT DEFAULT NULL,
    p_changes JSONB DEFAULT '{}',
    p_metadata JSONB DEFAULT '{}',
    p_status VARCHAR DEFAULT 'success',
    p_error_message TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO user_audit_log (
        user_id,
        user_email,
        organization_id,
        action_category,
        action_type,
        resource_type,
        resource_id,
        resource_name,
        method,
        endpoint,
        changes,
        metadata,
        status,
        error_message,
        ip_address,
        user_agent,
        session_id,
        created_at
    ) VALUES (
        p_user_id,
        p_user_email,
        p_organization_id,
        p_action_category,
        p_action_type,
        p_resource_type,
        p_resource_id,
        p_resource_name,
        p_method,
        p_endpoint,
        p_changes,
        p_metadata,
        p_status,
        p_error_message,
        p_ip_address,
        p_user_agent,
        p_session_id,
        NOW()
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. CREATE AUTOMATIC TRIGGERS FOR CRITICAL TABLES
-- ============================================================================

-- Trigger function for device changes
CREATE OR REPLACE FUNCTION audit_device_changes() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_user_action(
            auth.uid(),
            (SELECT email FROM auth.users WHERE id = auth.uid()),
            NEW.organization_id,
            'device_management',
            'device_create',
            'device',
            NEW.id,
            NEW.name,
            'POST',
            '/api/devices',
            jsonb_build_object('device', row_to_json(NEW)),
            '{}',
            'success'
        );
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM log_user_action(
            auth.uid(),
            (SELECT email FROM auth.users WHERE id = auth.uid()),
            NEW.organization_id,
            'device_management',
            'device_update',
            'device',
            NEW.id,
            NEW.name,
            'PUT',
            '/api/devices/' || NEW.id,
            jsonb_build_object(
                'before', row_to_json(OLD),
                'after', row_to_json(NEW)
            ),
            '{}',
            'success'
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_user_action(
            auth.uid(),
            (SELECT email FROM auth.users WHERE id = auth.uid()),
            OLD.organization_id,
            'device_management',
            'device_delete',
            'device',
            OLD.id,
            OLD.name,
            'DELETE',
            '/api/devices/' || OLD.id,
            jsonb_build_object('device', row_to_json(OLD)),
            '{}',
            'success'
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to devices table
DROP TRIGGER IF EXISTS trigger_audit_device_changes ON devices;
CREATE TRIGGER trigger_audit_device_changes
    AFTER INSERT OR UPDATE OR DELETE ON devices
    FOR EACH ROW EXECUTE FUNCTION audit_device_changes();

-- Trigger function for integration changes
CREATE OR REPLACE FUNCTION audit_integration_changes() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_user_action(
            auth.uid(),
            (SELECT email FROM auth.users WHERE id = auth.uid()),
            NEW.organization_id,
            'integration_management',
            'integration_create',
            'integration',
            NEW.id,
            NEW.name,
            'POST',
            '/api/integrations',
            jsonb_build_object('integration', row_to_json(NEW)),
            jsonb_build_object('integration_type', NEW.integration_type),
            'success'
        );
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM log_user_action(
            auth.uid(),
            (SELECT email FROM auth.users WHERE id = auth.uid()),
            NEW.organization_id,
            'integration_management',
            'integration_update',
            'integration',
            NEW.id,
            NEW.name,
            'PUT',
            '/api/integrations/' || NEW.id,
            jsonb_build_object(
                'before', row_to_json(OLD),
                'after', row_to_json(NEW)
            ),
            jsonb_build_object('integration_type', NEW.integration_type),
            'success'
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_user_action(
            auth.uid(),
            (SELECT email FROM auth.users WHERE id = auth.uid()),
            OLD.organization_id,
            'integration_management',
            'integration_delete',
            'integration',
            OLD.id,
            OLD.name,
            'DELETE',
            '/api/integrations/' || OLD.id,
            jsonb_build_object('integration', row_to_json(OLD)),
            jsonb_build_object('integration_type', OLD.integration_type),
            'success'
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to device_integrations table
DROP TRIGGER IF EXISTS trigger_audit_integration_changes ON device_integrations;
CREATE TRIGGER trigger_audit_integration_changes
    AFTER INSERT OR UPDATE OR DELETE ON device_integrations
    FOR EACH ROW EXECUTE FUNCTION audit_integration_changes();

-- Trigger function for alert acknowledgements (extends existing table)
CREATE OR REPLACE FUNCTION audit_alert_acknowledgement() RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_user_action(
        NEW.user_id,
        (SELECT email FROM auth.users WHERE id = NEW.user_id),
        NEW.organization_id,
        'alert_management',
        'alert_' || NEW.acknowledgement_type,
        'alert',
        NEW.alert_id,
        (SELECT alert_type FROM alerts WHERE id = NEW.alert_id),
        'POST',
        '/api/alerts/' || NEW.alert_id || '/acknowledge',
        jsonb_build_object('acknowledgement', row_to_json(NEW)),
        jsonb_build_object('acknowledgement_type', NEW.acknowledgement_type),
        'success'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to alert_acknowledgements table
DROP TRIGGER IF EXISTS trigger_audit_alert_acknowledgement ON alert_acknowledgements;
CREATE TRIGGER trigger_audit_alert_acknowledgement
    AFTER INSERT ON alert_acknowledgements
    FOR EACH ROW EXECUTE FUNCTION audit_alert_acknowledgement();

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

ALTER TABLE user_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view audit logs for their organization
CREATE POLICY "Users can view audit logs in their organization"
    ON user_audit_log FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Service role can insert audit logs (for system actions)
CREATE POLICY "Service role can insert audit logs"
    ON user_audit_log FOR INSERT
    WITH CHECK (true); -- Service role bypasses RLS anyway, but explicit policy is clearer

-- No direct user updates or deletes (audit logs are immutable)
-- Only service role or database functions can modify

-- ============================================================================
-- 6. CREATE VIEW FOR RECENT USER ACTIVITY
-- ============================================================================

CREATE OR REPLACE VIEW recent_user_activity AS
SELECT 
    ual.id,
    ual.user_id,
    ual.user_email,
    ual.organization_id,
    ual.action_category,
    ual.action_type,
    ual.resource_type,
    ual.resource_id,
    ual.resource_name,
    ual.status,
    ual.created_at,
    ual.ip_address,
    o.name as organization_name,
    u.email as current_user_email
FROM user_audit_log ual
LEFT JOIN organizations o ON ual.organization_id = o.id
LEFT JOIN auth.users u ON ual.user_id = u.id
WHERE ual.created_at > NOW() - INTERVAL '30 days'
ORDER BY ual.created_at DESC;

-- Grant access to authenticated users
GRANT SELECT ON recent_user_activity TO authenticated;

-- ============================================================================
-- 7. CREATE VIEW FOR SECURITY EVENTS
-- ============================================================================

CREATE OR REPLACE VIEW security_events AS
SELECT 
    ual.id,
    ual.user_id,
    ual.user_email,
    ual.organization_id,
    ual.action_type,
    ual.status,
    ual.error_message,
    ual.created_at,
    ual.ip_address,
    ual.user_agent,
    CASE 
        WHEN ual.status IN ('failed', 'error') THEN 'high'
        WHEN ual.action_type IN ('user_delete', 'organization_delete', 'integration_delete') THEN 'medium'
        ELSE 'low'
    END as severity
FROM user_audit_log ual
WHERE 
    ual.action_category IN ('authentication', 'user_management', 'organization_management')
    OR ual.status IN ('failed', 'error')
ORDER BY ual.created_at DESC;

-- Grant access to authenticated users
GRANT SELECT ON security_events TO authenticated;

COMMIT;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Log a user login
-- SELECT log_user_action(
--     auth.uid(),
--     'user@example.com',
--     'org-uuid',
--     'authentication',
--     'login',
--     NULL, NULL, NULL,
--     'POST',
--     '/auth/login',
--     '{}',
--     jsonb_build_object('login_method', 'password'),
--     'success',
--     NULL,
--     '192.168.1.1',
--     'Mozilla/5.0...',
--     'session-123'
-- );

-- Log a configuration change
-- SELECT log_user_action(
--     auth.uid(),
--     'user@example.com',
--     'org-uuid',
--     'configuration',
--     'settings_update',
--     'organization',
--     'org-uuid',
--     'My Organization',
--     'PUT',
--     '/api/settings',
--     jsonb_build_object('before', '{"theme": "light"}', 'after', '{"theme": "dark"}'),
--     '{}',
--     'success'
-- );

-- Query recent user activity
-- SELECT * FROM recent_user_activity 
-- WHERE user_id = auth.uid() 
-- ORDER BY created_at DESC 
-- LIMIT 50;

-- Query security events
-- SELECT * FROM security_events
-- WHERE organization_id = 'org-uuid'
-- AND severity = 'high'
-- ORDER BY created_at DESC;
