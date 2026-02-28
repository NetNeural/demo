-- ============================================================================
-- Device Types Configuration & Threshold Management
-- Issue #118: Centralized device type configuration with normal ranges,
-- alert thresholds, and measurement metadata
-- ============================================================================

-- Create device_types table
CREATE TABLE IF NOT EXISTS device_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Required fields
    name VARCHAR(100) NOT NULL,
    lower_normal DECIMAL(15, 6) NOT NULL,
    upper_normal DECIMAL(15, 6) NOT NULL,
    
    -- Strongly recommended
    unit VARCHAR(20) DEFAULT '',                     -- °C, %, lux, ppm, etc.
    
    -- Optional fields
    description TEXT,
    device_class VARCHAR(50),                         -- temperature, humidity, pressure, etc.
    lower_alert DECIMAL(15, 6),                       -- critical low threshold
    upper_alert DECIMAL(15, 6),                       -- critical high threshold
    precision_digits SMALLINT DEFAULT 2,              -- decimal places for display
    icon VARCHAR(50),                                 -- lucide icon name
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    CONSTRAINT device_types_unique_name_per_org UNIQUE (organization_id, name),
    CONSTRAINT device_types_normal_range_valid CHECK (lower_normal < upper_normal),
    CONSTRAINT device_types_lower_alert_valid CHECK (lower_alert IS NULL OR lower_alert <= lower_normal),
    CONSTRAINT device_types_upper_alert_valid CHECK (upper_alert IS NULL OR upper_alert >= upper_normal),
    CONSTRAINT device_types_precision_range CHECK (precision_digits >= 0 AND precision_digits <= 6)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_device_types_org ON device_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_device_types_name ON device_types(name);
CREATE INDEX IF NOT EXISTS idx_device_types_class ON device_types(device_class) WHERE device_class IS NOT NULL;

-- Enable RLS
ALTER TABLE device_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view device types for their organization
DROP POLICY IF EXISTS "device_types_select_org_members" ON device_types;
CREATE POLICY "device_types_select_org_members"
    ON device_types FOR SELECT
    USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role = 'super_admin'
        )
    );

-- Only admins/owners can create device types
DROP POLICY IF EXISTS "device_types_insert_admins" ON device_types;
CREATE POLICY "device_types_insert_admins"
    ON device_types FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.uid() 
            AND om.role IN ('admin', 'owner')
        )
        OR EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role = 'super_admin'
        )
    );

-- Only admins/owners can update device types
DROP POLICY IF EXISTS "device_types_update_admins" ON device_types;
CREATE POLICY "device_types_update_admins"
    ON device_types FOR UPDATE
    USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.uid() 
            AND om.role IN ('admin', 'owner')
        )
        OR EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role = 'super_admin'
        )
    );

-- Only admins/owners can delete device types
DROP POLICY IF EXISTS "device_types_delete_admins" ON device_types;
CREATE POLICY "device_types_delete_admins"
    ON device_types FOR DELETE
    USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om 
            WHERE om.user_id = auth.uid() 
            AND om.role IN ('admin', 'owner')
        )
        OR EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role = 'super_admin'
        )
    );

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_device_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS device_types_updated_at ON device_types;
CREATE TRIGGER device_types_updated_at
    BEFORE UPDATE ON device_types
    FOR EACH ROW
    EXECUTE FUNCTION update_device_types_updated_at();

-- Comments
COMMENT ON TABLE device_types IS 'Centralized device type configuration with normal ranges, alert thresholds, and measurement metadata';
COMMENT ON COLUMN device_types.lower_normal IS 'Lower bound of normal operating range (inclusive)';
COMMENT ON COLUMN device_types.upper_normal IS 'Upper bound of normal operating range (inclusive)';
COMMENT ON COLUMN device_types.lower_alert IS 'Critical low threshold — must be <= lower_normal';
COMMENT ON COLUMN device_types.upper_alert IS 'Critical high threshold — must be >= upper_normal';
COMMENT ON COLUMN device_types.unit IS 'Unit of measurement (°C, %, lux, ppm, etc.)';
COMMENT ON COLUMN device_types.device_class IS 'Measurement category (temperature, humidity, pressure, etc.)';
COMMENT ON COLUMN device_types.precision_digits IS 'Number of decimal places for display/validation';
