-- Migration: 20260215000002_sensor_activity.sql
-- Issue #105: Sensor Reading Details Page - Activity Timeline
-- Create sensor activity log table for tracking configuration changes and events

-- ============================================================================
-- 1. CREATE SENSOR_ACTIVITY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sensor_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    sensor_type VARCHAR(100) NOT NULL,
    
    -- Activity details
    activity_type VARCHAR(50) NOT NULL 
        CHECK (activity_type IN (
            'threshold_updated',
            'alert_triggered',
            'alert_resolved',
            'calibration',
            'maintenance',
            'status_change',
            'anomaly_detected',
            'manual_override',
            'configuration_change'
        )),
    
    -- Activity metadata
    description TEXT,
    severity VARCHAR(20) 
        CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
    
    -- Values and changes
    previous_value JSONB,
    new_value JSONB,
    
    -- User tracking
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    performed_by_name VARCHAR(255),  -- Cached for historical purposes
    
    -- Context
    metadata JSONB DEFAULT '{}',
    related_alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
    
    -- Timestamps
    occurred_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_sensor_activity_device 
    ON sensor_activity(device_id);

CREATE INDEX idx_sensor_activity_sensor_type 
    ON sensor_activity(sensor_type);

CREATE INDEX idx_sensor_activity_type 
    ON sensor_activity(activity_type);

CREATE INDEX idx_sensor_activity_occurred_at 
    ON sensor_activity(occurred_at DESC);

CREATE INDEX idx_sensor_activity_device_occurred 
    ON sensor_activity(device_id, occurred_at DESC);

CREATE INDEX idx_sensor_activity_severity 
    ON sensor_activity(severity) 
    WHERE severity IN ('high', 'critical');

-- ============================================================================
-- 3. ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE sensor_activity IS 
    'Activity timeline for sensor events and configuration changes (Issue #105)';

COMMENT ON COLUMN sensor_activity.activity_type IS 
    'Type of activity: threshold changes, alerts, maintenance, etc.';

COMMENT ON COLUMN sensor_activity.previous_value IS 
    'JSON snapshot of previous state/value before change';

COMMENT ON COLUMN sensor_activity.new_value IS 
    'JSON snapshot of new state/value after change';

COMMENT ON COLUMN sensor_activity.performed_by_name IS 
    'Cached username - preserved even if user is deleted';

COMMENT ON COLUMN sensor_activity.occurred_at IS 
    'When the activity actually occurred (may differ from created_at for historical imports)';

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE sensor_activity ENABLE ROW LEVEL SECURITY;

-- Users can view activity for devices in their organization
CREATE POLICY "Users can view sensor activity"
    ON sensor_activity FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM devices d
            WHERE d.id = sensor_activity.device_id
            AND d.organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- Only admins can insert activity records manually
CREATE POLICY "Admins can create sensor activity"
    ON sensor_activity FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM devices d
            JOIN organization_members om ON om.organization_id = d.organization_id
            WHERE d.id = sensor_activity.device_id
            AND om.user_id = auth.uid()
            AND om.role IN ('org_admin', 'org_owner')
        )
    );

-- Service role can do anything (for automated logging)
CREATE POLICY "Service role full access to sensor activity"
    ON sensor_activity FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON sensor_activity TO authenticated;
GRANT ALL ON sensor_activity TO service_role;

-- ============================================================================
-- 6. HELPER FUNCTION: LOG SENSOR ACTIVITY
-- ============================================================================

CREATE OR REPLACE FUNCTION log_sensor_activity(
    p_device_id UUID,
    p_sensor_type VARCHAR,
    p_activity_type VARCHAR,
    p_description TEXT DEFAULT NULL,
    p_severity VARCHAR DEFAULT 'info',
    p_previous_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_activity_id UUID;
    v_user_name VARCHAR(255);
BEGIN
    -- Get current user's name if authenticated
    SELECT full_name INTO v_user_name
    FROM users
    WHERE id = auth.uid();
    
    -- Insert activity record
    INSERT INTO sensor_activity (
        device_id,
        sensor_type,
        activity_type,
        description,
        severity,
        previous_value,
        new_value,
        performed_by,
        performed_by_name,
        metadata
    ) VALUES (
        p_device_id,
        p_sensor_type,
        p_activity_type,
        p_description,
        p_severity,
        p_previous_value,
        p_new_value,
        auth.uid(),
        v_user_name,
        p_metadata
    )
    RETURNING id INTO v_activity_id;
    
    RETURN v_activity_id;
END;
$$;

COMMENT ON FUNCTION log_sensor_activity IS 
    'Helper function to log sensor activity with automatic user tracking';

-- ============================================================================
-- 7. TRIGGER: AUTO-LOG THRESHOLD CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_log_threshold_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log threshold updates
    IF TG_OP = 'UPDATE' THEN
        PERFORM log_sensor_activity(
            p_device_id := NEW.device_id,
            p_sensor_type := NEW.sensor_type,
            p_activity_type := 'threshold_updated',
            p_description := 'Sensor threshold configuration updated',
            p_severity := 'info',
            p_previous_value := to_jsonb(OLD),
            p_new_value := to_jsonb(NEW),
            p_metadata := jsonb_build_object(
                'threshold_id', NEW.id,
                'alert_enabled', NEW.alert_enabled
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_threshold_changes
    AFTER UPDATE ON sensor_thresholds
    FOR EACH ROW
    EXECUTE FUNCTION auto_log_threshold_changes();

COMMENT ON TRIGGER trg_log_threshold_changes ON sensor_thresholds IS 
    'Automatically logs threshold configuration changes to sensor_activity';
