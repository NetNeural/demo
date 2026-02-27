-- ============================================================================
-- Migration: Facility Maps & Device Placements
-- ============================================================================
-- Supports the Facilities Map feature (Issue #300):
--   - Upload floor plan / site images per location
--   - Place devices on the map with x/y coordinates
--   - Store map metadata (dimensions, floor level, etc.)
--
-- File: 20260227100000_facility_maps.sql

-- ============================================================================
-- 1. Facility Maps table
-- ============================================================================
CREATE TABLE IF NOT EXISTS facility_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    floor_level INTEGER DEFAULT 0,
    -- Image metadata
    image_url TEXT,                  -- Public URL in Supabase Storage
    image_path TEXT,                 -- Storage path (for deletion)
    image_width INTEGER,            -- Original pixel width
    image_height INTEGER,           -- Original pixel height
    -- Map settings
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{}',    -- Additional config (zoom defaults, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 2. Device Map Placements table
-- ============================================================================
CREATE TABLE IF NOT EXISTS device_map_placements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_map_id UUID NOT NULL REFERENCES facility_maps(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    -- Position on the map (percentage-based 0-100 for responsive scaling)
    x_percent DECIMAL(6,3) NOT NULL CHECK (x_percent >= 0 AND x_percent <= 100),
    y_percent DECIMAL(6,3) NOT NULL CHECK (y_percent >= 0 AND y_percent <= 100),
    -- Display settings
    label VARCHAR(255),             -- Optional custom label (defaults to device name)
    icon_size VARCHAR(20) DEFAULT 'medium',  -- 'small', 'medium', 'large'
    rotation DECIMAL(5,2) DEFAULT 0,         -- Degrees
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Each device can only appear once per map
    UNIQUE(facility_map_id, device_id)
);

-- ============================================================================
-- 3. Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_facility_maps_org ON facility_maps(organization_id);
CREATE INDEX IF NOT EXISTS idx_facility_maps_location ON facility_maps(location_id);
CREATE INDEX IF NOT EXISTS idx_facility_maps_active ON facility_maps(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_device_map_placements_map ON device_map_placements(facility_map_id);
CREATE INDEX IF NOT EXISTS idx_device_map_placements_device ON device_map_placements(device_id);

-- ============================================================================
-- 4. Row Level Security
-- ============================================================================
ALTER TABLE facility_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_map_placements ENABLE ROW LEVEL SECURITY;

-- Facility maps: users can see maps belonging to their organizations
CREATE POLICY "Users can view their org facility maps"
    ON facility_maps FOR SELECT
    USING (
        organization_id IN (
            SELECT om.organization_id FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert facility maps"
    ON facility_maps FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id FROM organization_members om
            WHERE om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins can update facility maps"
    ON facility_maps FOR UPDATE
    USING (
        organization_id IN (
            SELECT om.organization_id FROM organization_members om
            WHERE om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins can delete facility maps"
    ON facility_maps FOR DELETE
    USING (
        organization_id IN (
            SELECT om.organization_id FROM organization_members om
            WHERE om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- Device map placements: inherit from facility_maps
CREATE POLICY "Users can view device placements on their maps"
    ON device_map_placements FOR SELECT
    USING (
        facility_map_id IN (
            SELECT fm.id FROM facility_maps fm
            JOIN organization_members om ON om.organization_id = fm.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert device placements"
    ON device_map_placements FOR INSERT
    WITH CHECK (
        facility_map_id IN (
            SELECT fm.id FROM facility_maps fm
            JOIN organization_members om ON om.organization_id = fm.organization_id
            WHERE om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins can update device placements"
    ON device_map_placements FOR UPDATE
    USING (
        facility_map_id IN (
            SELECT fm.id FROM facility_maps fm
            JOIN organization_members om ON om.organization_id = fm.organization_id
            WHERE om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins can delete device placements"
    ON device_map_placements FOR DELETE
    USING (
        facility_map_id IN (
            SELECT fm.id FROM facility_maps fm
            JOIN organization_members om ON om.organization_id = fm.organization_id
            WHERE om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- ============================================================================
-- 5. Storage bucket for facility map images
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'facility-maps',
    'facility-maps',
    true,
    10485760,  -- 10MB
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view facility map images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'facility-maps');

CREATE POLICY "Authenticated users can upload facility map images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'facility-maps'
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can update facility map images"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'facility-maps'
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can delete facility map images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'facility-maps'
        AND auth.role() = 'authenticated'
    );

-- ============================================================================
-- 6. Updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_facility_maps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER facility_maps_updated_at
    BEFORE UPDATE ON facility_maps
    FOR EACH ROW EXECUTE FUNCTION update_facility_maps_updated_at();

CREATE TRIGGER device_map_placements_updated_at
    BEFORE UPDATE ON device_map_placements
    FOR EACH ROW EXECUTE FUNCTION update_facility_maps_updated_at();
