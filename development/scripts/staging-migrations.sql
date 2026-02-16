-- ============================================================================
-- STAGING DATABASE MIGRATION SCRIPT
-- Apply these migrations to fix 500 errors for sensor_thresholds and sensor_activity
-- ============================================================================
-- Run this in Supabase Dashboard > SQL Editor for staging project
-- Project: atgbmxicqikmapfqouco (demo-stage.netneural.ai)
-- ============================================================================

BEGIN;

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
    
    -- Temperature unit preference  
    temperature_unit VARCHAR(20) DEFAULT 'celsius'
        CHECK (temperature_unit IN ('celsius', 'fahrenheit')),
    
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_device 
    ON sensor_thresholds(device_id);

CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_alert_enabled 
    ON sensor_thresholds(alert_enabled) 
    WHERE alert_enabled = true;

CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_sensor_type 
    ON sensor_thresholds(sensor_type);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_sensor_thresholds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trg_sensor_thresholds_updated_at ON sensor_thresholds;

CREATE TRIGGER trg_sensor_thresholds_updated_at
    BEFORE UPDATE ON sensor_thresholds
    FOR EACH ROW
    EXECUTE FUNCTION update_sensor_thresholds_updated_at();

-- ============================================================================
-- 2. CREATE SENSOR_ACTIVITY TABLE
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
    performed_by_name VARCHAR(255),
    
    -- Context
    metadata JSONB DEFAULT '{}',
    related_alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
    
    -- Timestamps
    occurred_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sensor_activity_device 
    ON sensor_activity(device_id);

CREATE INDEX IF NOT EXISTS idx_sensor_activity_occurred_at 
    ON sensor_activity(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_activity_type 
    ON sensor_activity(activity_type);

CREATE INDEX IF NOT EXISTS idx_sensor_activity_sensor_type 
    ON sensor_activity(sensor_type);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE sensor_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_activity ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS sensor_thresholds_org_read ON sensor_thresholds;
DROP POLICY IF EXISTS sensor_thresholds_org_write ON sensor_thresholds;
DROP POLICY IF EXISTS sensor_activity_org_read ON sensor_activity;
DROP POLICY IF EXISTS sensor_activity_org_write ON sensor_activity;

-- sensor_thresholds policies
CREATE POLICY sensor_thresholds_org_read ON sensor_thresholds
    FOR SELECT
    USING (
        device_id IN (
            SELECT d.id FROM devices d
            INNER JOIN user_organizations uo ON uo.organization_id = d.organization_id
            WHERE uo.user_id = auth.uid()
        )
    );

CREATE POLICY sensor_thresholds_org_write ON sensor_thresholds
    FOR ALL
    USING (
        device_id IN (
            SELECT d.id FROM devices d
            INNER JOIN user_organizations uo ON uo.organization_id = d.organization_id
            WHERE uo.user_id = auth.uid()
        )
    );

-- sensor_activity policies
CREATE POLICY sensor_activity_org_read ON sensor_activity
    FOR SELECT
    USING (
        device_id IN (
            SELECT d.id FROM devices d
            INNER JOIN user_organizations uo ON uo.organization_id = d.organization_id
            WHERE uo.user_id = auth.uid()
        )
    );

CREATE POLICY sensor_activity_org_write ON sensor_activity
    FOR ALL
    USING (
        device_id IN (
            SELECT d.id FROM devices d
            INNER JOIN user_organizations uo ON uo.organization_id = d.organization_id
            WHERE uo.user_id = auth.uid()
        )
    );

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON sensor_thresholds TO authenticated;
GRANT ALL ON sensor_activity TO authenticated;
GRANT SELECT ON sensor_thresholds TO anon;
GRANT SELECT ON sensor_activity TO anon;

COMMIT;

-- ============================================================================
-- ✅ MIGRATION COMPLETE
-- ============================================================================
-- Tables created:
--   - sensor_thresholds (with temperature_unit column)
--   - sensor_activity
-- 
-- Next steps:
--   1. Verify tables exist: SELECT * FROM sensor_thresholds LIMIT 1;
--   2. Refresh the application
--   3. 500 errors should be resolved
-- ============================================================================
