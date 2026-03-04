-- =============================================================================
-- Migration: Add super_admin bypass to facility_maps and device_map_placements
-- =============================================================================
-- facility_maps policies only checked organization_members, blocking super_admin
-- users who are visiting/managing orgs they are not explicitly members of.
-- Fix: add OR public.is_super_admin() to all USING / WITH CHECK clauses.
-- =============================================================================

-- ── facility_maps ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their org facility maps" ON facility_maps;
DROP POLICY IF EXISTS "Admins can insert facility maps" ON facility_maps;
DROP POLICY IF EXISTS "Admins can update facility maps" ON facility_maps;
DROP POLICY IF EXISTS "Admins can delete facility maps" ON facility_maps;

CREATE POLICY "Users can view their org facility maps"
  ON facility_maps FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR public.is_super_admin()
  );

CREATE POLICY "Admins can insert facility maps"
  ON facility_maps FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
    OR public.is_super_admin()
  );

CREATE POLICY "Admins can update facility maps"
  ON facility_maps FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
    OR public.is_super_admin()
  );

CREATE POLICY "Admins can delete facility maps"
  ON facility_maps FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
    OR public.is_super_admin()
  );

-- ── device_map_placements ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view device placements on their maps" ON device_map_placements;
DROP POLICY IF EXISTS "Admins can insert device placements" ON device_map_placements;
DROP POLICY IF EXISTS "Admins can update device placements" ON device_map_placements;
DROP POLICY IF EXISTS "Admins can delete device placements" ON device_map_placements;

CREATE POLICY "Users can view device placements on their maps"
  ON device_map_placements FOR SELECT
  USING (
    facility_map_id IN (
      SELECT fm.id FROM facility_maps fm
      JOIN organization_members om ON om.organization_id = fm.organization_id
      WHERE om.user_id = auth.uid()
    )
    OR public.is_super_admin()
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
    OR public.is_super_admin()
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
    OR public.is_super_admin()
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
    OR public.is_super_admin()
  );
