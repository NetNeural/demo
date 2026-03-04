-- Fix: Audit log triggers fail during organization cascade deletes
-- Issue: #352 - Error deleting Organization
--
-- Root cause: When an organization is deleted, CASCADE deletes devices/integrations.
-- The AFTER DELETE triggers on those tables try to INSERT into user_audit_log
-- with the organization_id that is being deleted, causing a FK violation.
--
-- Fix: Add exception handling to log_user_action() so FK violations during
-- cascade deletes are handled gracefully (log with NULL organization_id).

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
    EXCEPTION WHEN foreign_key_violation THEN
        -- During cascade deletes (e.g., org deletion), the referenced org
        -- may be in the process of being deleted. Log with NULL org_id instead.
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
            NULL,
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
            COALESCE(p_error_message, 'cascade_delete'),
            p_ip_address,
            p_user_agent,
            p_session_id,
            NOW()
        ) RETURNING id INTO v_log_id;
    END;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
