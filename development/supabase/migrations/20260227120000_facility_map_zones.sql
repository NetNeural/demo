-- ============================================================================
-- Migration: Facility Map Zones (Annotations / Polygons)
-- ============================================================================
-- Supports zone annotations on facility maps (Issue #302):
--   - Users can draw polygon zones over floor plans
--   - Zones have name, color, opacity, and ordered polygon points
--   - Zones are layered with z_order for stacking
--
-- File: 20260227120000_facility_map_zones.sql

-- ============================================================================
-- 1. Facility Map Zones table
-- ============================================================================
CREATE TABLE IF NOT EXISTS facility_map_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_map_id UUID NOT NULL REFERENCES facility_maps(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
    opacity DECIMAL(3,2) NOT NULL DEFAULT 0.25 CHECK (opacity >= 0 AND opacity <= 1),
    -- Polygon points as JSONB array of {x, y} percentage coordinates
    points JSONB NOT NULL DEFAULT '[]',
    z_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_facility_map_zones_map ON facility_map_zones(facility_map_id);
CREATE INDEX IF NOT EXISTS idx_facility_map_zones_order ON facility_map_zones(facility_map_id, z_order);

-- ============================================================================
-- 3. Row Level Security
-- ============================================================================
ALTER TABLE facility_map_zones ENABLE ROW LEVEL SECURITY;

-- Zones: inherit access from parent facility_maps via organization membership
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
