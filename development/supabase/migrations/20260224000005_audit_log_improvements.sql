-- Migration: Audit Log Improvements
-- 1. Fix device trigger to skip automated telemetry noise (metadata-only with no auth user)
-- 2. Add audit triggers for organization_members (user_management)
-- 3. Add audit triggers for organizations (organization_management)
-- 4. Add audit triggers for alert_rules (alert_management)
-- 5. Backfill user_email on existing NULL entries where user_id is known

-- ============================================================
-- 1. Fix audit_device_changes: skip automated telemetry updates
-- ============================================================
CREATE OR REPLACE FUNCTION audit_device_changes()
RETURNS TRIGGER AS $$
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
        -- Skip automated telemetry updates (no authenticated user + only metadata/updated_at changed)
        IF auth.uid() IS NULL THEN
            -- Check if ONLY metadata and/or updated_at changed
            IF (OLD.name IS NOT DISTINCT FROM NEW.name
                AND OLD.status IS NOT DISTINCT FROM NEW.status
                AND OLD.organization_id IS NOT DISTINCT FROM NEW.organization_id
                AND OLD.location_id IS NOT DISTINCT FROM NEW.location_id
                AND OLD.department_id IS NOT DISTINCT FROM NEW.department_id
                AND OLD.device_type_id IS NOT DISTINCT FROM NEW.device_type_id
                AND OLD.firmware_version IS NOT DISTINCT FROM NEW.firmware_version) THEN
                -- Only metadata/updated_at changed by system process — skip audit
                RETURN NEW;
            END IF;
        END IF;

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

-- ============================================================
-- 2. Audit trigger for organization_members (user_management)
-- ============================================================
CREATE OR REPLACE FUNCTION audit_organization_member_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_user_email TEXT;
    v_member_email TEXT;
BEGIN
    -- Get the acting user's email
    SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

    IF TG_OP = 'INSERT' THEN
        -- Get the new member's email
        SELECT email INTO v_member_email FROM auth.users WHERE id = NEW.user_id;

        PERFORM log_user_action(
            COALESCE(auth.uid(), NEW.invited_by),
            COALESCE(v_user_email, (SELECT email FROM auth.users WHERE id = NEW.invited_by)),
            NEW.organization_id,
            'user_management',
            'member_added',
            'organization_member',
            NEW.id,
            COALESCE(v_member_email, NEW.user_id::text),
            'POST',
            '/api/organizations/' || NEW.organization_id || '/members',
            jsonb_build_object('member', row_to_json(NEW)),
            jsonb_build_object('role', NEW.role),
            'success'
        );

    ELSIF TG_OP = 'UPDATE' THEN
        SELECT email INTO v_member_email FROM auth.users WHERE id = NEW.user_id;

        -- Check if role changed
        IF OLD.role IS DISTINCT FROM NEW.role THEN
            PERFORM log_user_action(
                auth.uid(),
                v_user_email,
                NEW.organization_id,
                'user_management',
                'member_role_changed',
                'organization_member',
                NEW.id,
                COALESCE(v_member_email, NEW.user_id::text),
                'PUT',
                '/api/organizations/' || NEW.organization_id || '/members/' || NEW.id,
                jsonb_build_object(
                    'before', jsonb_build_object('role', OLD.role),
                    'after', jsonb_build_object('role', NEW.role)
                ),
                jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role),
                'success'
            );
        END IF;

        -- Check if permissions changed
        IF OLD.permissions IS DISTINCT FROM NEW.permissions THEN
            PERFORM log_user_action(
                auth.uid(),
                v_user_email,
                NEW.organization_id,
                'user_management',
                'member_permissions_updated',
                'organization_member',
                NEW.id,
                COALESCE(v_member_email, NEW.user_id::text),
                'PUT',
                '/api/organizations/' || NEW.organization_id || '/members/' || NEW.id,
                jsonb_build_object(
                    'before', jsonb_build_object('permissions', OLD.permissions),
                    'after', jsonb_build_object('permissions', NEW.permissions)
                ),
                '{}',
                'success'
            );
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        SELECT email INTO v_member_email FROM auth.users WHERE id = OLD.user_id;

        PERFORM log_user_action(
            auth.uid(),
            v_user_email,
            OLD.organization_id,
            'user_management',
            'member_removed',
            'organization_member',
            OLD.id,
            COALESCE(v_member_email, OLD.user_id::text),
            'DELETE',
            '/api/organizations/' || OLD.organization_id || '/members/' || OLD.id,
            jsonb_build_object('member', row_to_json(OLD)),
            jsonb_build_object('role', OLD.role),
            'success'
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_audit_organization_member_changes
    AFTER INSERT OR UPDATE OR DELETE ON organization_members
    FOR EACH ROW EXECUTE FUNCTION audit_organization_member_changes();

-- ============================================================
-- 3. Audit trigger for organizations (organization_management)
-- ============================================================
CREATE OR REPLACE FUNCTION audit_organization_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

    IF TG_OP = 'UPDATE' THEN
        -- Skip if only updated_at changed
        IF OLD.name IS NOT DISTINCT FROM NEW.name
           AND OLD.settings IS NOT DISTINCT FROM NEW.settings
           AND OLD.description IS NOT DISTINCT FROM NEW.description THEN
            RETURN NEW;
        END IF;

        PERFORM log_user_action(
            auth.uid(),
            v_user_email,
            NEW.id,
            'organization_management',
            CASE
                WHEN OLD.settings IS DISTINCT FROM NEW.settings THEN 'settings_updated'
                WHEN OLD.name IS DISTINCT FROM NEW.name THEN 'name_changed'
                ELSE 'organization_updated'
            END,
            'organization',
            NEW.id,
            NEW.name,
            'PUT',
            '/api/organizations/' || NEW.id,
            jsonb_build_object(
                'before', row_to_json(OLD),
                'after', row_to_json(NEW)
            ),
            '{}',
            'success'
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_audit_organization_changes
    AFTER UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION audit_organization_changes();

-- ============================================================
-- 4. Audit trigger for alert_rules (alert_management)
-- ============================================================
CREATE OR REPLACE FUNCTION audit_alert_rule_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

    IF TG_OP = 'INSERT' THEN
        PERFORM log_user_action(
            auth.uid(),
            v_user_email,
            NEW.organization_id,
            'alert_management',
            'alert_rule_created',
            'alert_rule',
            NEW.id,
            NEW.name,
            'POST',
            '/api/alert-rules',
            jsonb_build_object('rule', row_to_json(NEW)),
            jsonb_build_object('severity', NEW.severity, 'enabled', NEW.is_active),
            'success'
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Skip if only updated_at changed
        IF OLD.name IS NOT DISTINCT FROM NEW.name
           AND OLD.is_active IS NOT DISTINCT FROM NEW.is_active
           AND OLD.severity IS NOT DISTINCT FROM NEW.severity
           AND OLD.conditions IS NOT DISTINCT FROM NEW.conditions
           AND OLD.notification_channels IS NOT DISTINCT FROM NEW.notification_channels THEN
            RETURN NEW;
        END IF;

        PERFORM log_user_action(
            auth.uid(),
            v_user_email,
            NEW.organization_id,
            'alert_management',
            CASE
                WHEN OLD.is_active IS DISTINCT FROM NEW.is_active THEN
                    CASE WHEN NEW.is_active THEN 'alert_rule_enabled' ELSE 'alert_rule_disabled' END
                ELSE 'alert_rule_updated'
            END,
            'alert_rule',
            NEW.id,
            NEW.name,
            'PUT',
            '/api/alert-rules/' || NEW.id,
            jsonb_build_object(
                'before', row_to_json(OLD),
                'after', row_to_json(NEW)
            ),
            jsonb_build_object('severity', NEW.severity, 'enabled', NEW.is_active),
            'success'
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_user_action(
            auth.uid(),
            v_user_email,
            OLD.organization_id,
            'alert_management',
            'alert_rule_deleted',
            'alert_rule',
            OLD.id,
            OLD.name,
            'DELETE',
            '/api/alert-rules/' || OLD.id,
            jsonb_build_object('rule', row_to_json(OLD)),
            jsonb_build_object('severity', OLD.severity),
            'success'
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_audit_alert_rule_changes
    AFTER INSERT OR UPDATE OR DELETE ON alert_rules
    FOR EACH ROW EXECUTE FUNCTION audit_alert_rule_changes();

-- ============================================================
-- 5. Backfill user_email on existing entries where user_id is known
-- ============================================================
UPDATE user_audit_log ual
SET user_email = au.email
FROM auth.users au
WHERE ual.user_id = au.id
  AND ual.user_email IS NULL;

-- ============================================================
-- 6. Grant execute on log_user_action to authenticated users
--    (needed for client-side login/logout auditing via RPC)
-- ============================================================
GRANT EXECUTE ON FUNCTION log_user_action TO authenticated;
