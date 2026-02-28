-- Fix: Remove references to non-existent columns (description, is_deleted, deleted_at)
-- from audit_device_changes() trigger function.
-- These columns don't exist on the devices table, causing:
--   "record 'old' has no field 'description'" error on any device UPDATE
--   (e.g., device transfer between organizations)
-- See: GitHub Issue #286

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
