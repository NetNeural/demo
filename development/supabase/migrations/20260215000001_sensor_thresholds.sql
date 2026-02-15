-- Migration: 20260215000001_sensor_thresholds.sql
-- Issue #105: Sensor Reading Details Page - Threshold Configuration
-- Create sensor threshold configuration table for alert management

-- ============================================================================
-- 1. CREATE SENSOR_THRESHOLDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sensor_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    sensor_type VARCHAR(100) NOT NULL,
    
    -- Threshold values
    min_value DECIMAL(15, 6),
    max_value DECIMAL(15, 6),
    critical_min DECIMAL(15, 6),
    critical_max DECIMAL(15, 6),
    
    -- Alert configuration
    alert_enabled BOOLEAN DEFAULT true,
    alert_message TEXT,
    alert_severity VARCHAR(20) DEFAULT 'medium' 
        CHECK (alert_severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Notification preferences
    notify_on_breach BOOLEAN DEFAULT true,
    notification_cooldown_minutes INTEGER DEFAULT 15,
    last_notification_at TIMESTAMPTZ,
    
    -- Metadata
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Unique constraint: one threshold config per device+sensor_type
    CONSTRAINT unique_device_sensor_threshold UNIQUE (device_id, sensor_type)
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_sensor_thresholds_device 
    ON sensor_thresholds(device_id);

CREATE INDEX idx_sensor_thresholds_alert_enabled 
    ON sensor_thresholds(alert_enabled) 
    WHERE alert_enabled = true;

CREATE INDEX idx_sensor_thresholds_sensor_type 
    ON sensor_thresholds(sensor_type);

-- ============================================================================
-- 3. ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE sensor_thresholds IS 
    'Threshold configuration for sensor alerts (Issue #105)';

COMMENT ON COLUMN sensor_thresholds.min_value IS 
    'Warning threshold minimum - alerts when sensor value drops below';

COMMENT ON COLUMN sensor_thresholds.max_value IS 
    'Warning threshold maximum - alerts when sensor value exceeds';

COMMENT ON COLUMN sensor_thresholds.critical_min IS 
    'Critical threshold minimum - urgent alerts';

COMMENT ON COLUMN sensor_thresholds.critical_max IS 
    'Critical threshold maximum - urgent alerts';

COMMENT ON COLUMN sensor_thresholds.notification_cooldown_minutes IS 
    'Minimum time between repeated notifications for same breach';

-- ============================================================================
-- 4. CREATE UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_sensor_thresholds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sensor_thresholds_updated_at
    BEFORE UPDATE ON sensor_thresholds
    FOR EACH ROW
    EXECUTE FUNCTION update_sensor_thresholds_updated_at();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE sensor_thresholds ENABLE ROW LEVEL SECURITY;

-- Users can view thresholds for devices in their organization
CREATE POLICY "Users can view threshold configurations"
    ON sensor_thresholds FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM devices d
            WHERE d.id = sensor_thresholds.device_id
            AND d.organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- Users with org_admin or org_owner role can manage thresholds
CREATE POLICY "Admins can manage threshold configurations"
    ON sensor_thresholds FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM devices d
            JOIN organization_members om ON om.organization_id = d.organization_id
            WHERE d.id = sensor_thresholds.device_id
            AND om.user_id = auth.uid()
            AND om.role IN ('org_admin', 'org_owner')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM devices d
            JOIN organization_members om ON om.organization_id = d.organization_id
            WHERE d.id = sensor_thresholds.device_id
            AND om.user_id = auth.uid()
            AND om.role IN ('org_admin', 'org_owner')
        )
    );

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON sensor_thresholds TO authenticated;
GRANT ALL ON sensor_thresholds TO service_role;
