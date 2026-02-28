-- ============================================================================
-- Migration: Facility Map Zones (Issue #302)
-- ============================================================================
-- Supports drawing labeled zones on facility maps (e.g. "Server Room",
-- "Cold Storage"). Zones are semi-transparent SVG polygon overlays
-- positioned with percentage-based coordinates.
--
-- File: 20260228100000_facility_map_zones.sql

-- ============================================================================
-- 1. Facility Map Zones table
-- ============================================================================
CREATE TABLE IF NOT EXISTS facility_map_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_map_id UUID NOT NULL REFERENCES facility_maps(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    zone_type VARCHAR(50),                -- 'cold_storage', 'server_room', 'office', etc.
    color VARCHAR(9) DEFAULT '#3B82F6',   -- Hex color with optional alpha
    -- Polygon points as JSON array: [{x: 10.5, y: 20.3}, ...]
    -- Coordinates are percentage-based (0-100) for responsive scaling
    points JSONB NOT NULL DEFAULT '[]',
    z_order INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_facility_map_zones_map
    ON facility_map_zones(facility_map_id);

-- ============================================================================
-- 3. Row Level Security
-- ============================================================================
ALTER TABLE facility_map_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view zones on their org maps"
    ON facility_map_zones FOR SELECT
    USING (
        facility_map_id IN (
            SELECT fm.id FROM facility_maps fm
            JOIN organization_members om ON om.organization_id = fm.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert zones"
    ON facility_map_zones FOR INSERT
    WITH CHECK (
        facility_map_id IN (
            SELECT fm.id FROM facility_maps fm
            JOIN organization_members om ON om.organization_id = fm.organization_id
            WHERE om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins can update zones"
    ON facility_map_zones FOR UPDATE
    USING (
        facility_map_id IN (
            SELECT fm.id FROM facility_maps fm
            JOIN organization_members om ON om.organization_id = fm.organization_id
            WHERE om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admins can delete zones"
    ON facility_map_zones FOR DELETE
    USING (
        facility_map_id IN (
            SELECT fm.id FROM facility_maps fm
            JOIN organization_members om ON om.organization_id = fm.organization_id
            WHERE om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- ============================================================================
-- 4. Updated_at trigger (reuses existing function)
-- ============================================================================
CREATE TRIGGER facility_map_zones_updated_at
    BEFORE UPDATE ON facility_map_zones
    FOR EACH ROW EXECUTE FUNCTION update_facility_maps_updated_at();
