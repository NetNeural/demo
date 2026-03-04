-- ============================================================
-- Migration: Exclude test sensors and offline devices from
--            reseller sensor counts
--
-- Changes to calculate_effective_sensor_count():
--   1. Exclude devices where is_test_device = true
--   2. Only count devices with status = 'online' (remove the
--      48-hour last_seen fallback — offline devices should
--      not inflate reseller tier/billing counts)
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_effective_sensor_count(org_id UUID)
RETURNS TABLE (
  direct_sensors     INT,
  downstream_sensors INT,
  effective_total    INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH RECURSIVE downline AS (
    SELECT id, parent_organization_id, ARRAY[id] AS path
    FROM organizations
    WHERE id = org_id

    UNION ALL

    SELECT o.id, o.parent_organization_id, d.path || o.id
    FROM organizations o
    JOIN downline d ON o.parent_organization_id = d.id
    WHERE NOT (o.id = ANY(d.path)) AND array_length(d.path, 1) < 20
  ),
  sensor_counts AS (
    SELECT
      dl.id AS org_id,
      COUNT(d.id)::INT AS sensor_count
    FROM downline dl
    LEFT JOIN devices d ON d.organization_id = dl.id
      AND d.deleted_at IS NULL
      AND d.is_test_device = false         -- exclude test/demo sensors
      AND d.status = 'online'              -- only currently-reporting devices
    GROUP BY dl.id
  )
  SELECT
    COALESCE((SELECT sensor_count FROM sensor_counts WHERE org_id = calculate_effective_sensor_count.org_id), 0) AS direct_sensors,
    COALESCE(SUM(sc.sensor_count) FILTER (WHERE sc.org_id != calculate_effective_sensor_count.org_id), 0)::INT   AS downstream_sensors,
    COALESCE(SUM(sc.sensor_count), 0)::INT                                                                       AS effective_total
  FROM sensor_counts sc;
$$;

COMMENT ON FUNCTION calculate_effective_sensor_count(UUID) IS
  'Calculates the effective sensor count for a reseller org (direct + downstream). '
  'Excludes test devices (is_test_device = true) and offline/non-reporting devices. '
  'Only devices with status = ''online'' are counted.';
