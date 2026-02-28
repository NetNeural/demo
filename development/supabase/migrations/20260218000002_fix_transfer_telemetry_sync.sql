-- Migration: 20260218000002_fix_transfer_telemetry_sync.sql
-- Fix: Sync orphaned device_telemetry_history records after device transfer
-- Fix: Correct device_data RLS policy (table has no organization_id column)
--
-- Problem: When devices are transferred between organizations, the
-- device_telemetry_history.organization_id may not be updated if the
-- telemetry move step fails silently (it's treated as non-fatal).
-- This leaves historical telemetry invisible in the new org due to RLS
-- and the HistoricalDataViewer's org_id filter.
--
-- Also: The previous security remediation migration created an RLS policy
-- on device_data referencing organization_id, but that column doesn't
-- exist on device_data. Fix it to JOIN through devices instead.

-- ============================================================================
-- 1. REPAIR: Sync orphaned telemetry records
-- ============================================================================
-- Update device_telemetry_history.organization_id to match the device's
-- current organization_id for any records where they're out of sync.
-- This repairs device M260600010 and any other previously transferred devices.

UPDATE device_telemetry_history dth
SET organization_id = d.organization_id
FROM devices d
WHERE dth.device_id = d.id
  AND dth.organization_id != d.organization_id;

-- ============================================================================
-- 2. FIX: device_data RLS policy
-- ============================================================================
-- device_data does NOT have an organization_id column.
-- The policy must scope access through the devices table instead.

DROP POLICY IF EXISTS "device_data_select_authenticated" ON device_data;
CREATE POLICY "device_data_select_authenticated"
  ON device_data FOR SELECT TO authenticated
  USING (
    device_id IN (
      SELECT d.id FROM devices d
      WHERE d.organization_id IN (
        SELECT om.organization_id FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 3. REPAIR: Sync orphaned alert records (same pattern)
-- ============================================================================
-- Alerts may also have stale organization_id after transfer

UPDATE alerts a
SET organization_id = d.organization_id
FROM devices d
WHERE a.device_id = d.id
  AND a.organization_id != d.organization_id;
