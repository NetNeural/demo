-- ============================================================
-- Migration: Project Hydra – Global Tier Table & Sensor Roll-up
-- Stories: #327, #328
-- ============================================================

-- ─── Reseller tier table (admin-configurable) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS reseller_tiers (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT         NOT NULL UNIQUE,    -- 'Starter', 'Bronze', 'Silver', 'Gold', 'Platinum'
  min_sensors   INT          NOT NULL,
  max_sensors   INT          NULL,               -- NULL = unlimited (top tier)
  discount_pct  NUMERIC(5,4) NOT NULL,           -- e.g. 0.10 = 10%
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order    INT          NOT NULL DEFAULT 0, -- for display ordering
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- Ensure no overlapping ranges
  CONSTRAINT reseller_tiers_min_non_negative CHECK (min_sensors >= 0),
  CONSTRAINT reseller_tiers_max_after_min CHECK (max_sensors IS NULL OR max_sensors > min_sensors),
  CONSTRAINT reseller_tiers_discount_range CHECK (discount_pct >= 0 AND discount_pct <= 1)
);

-- Seed default tiers (idempotent)
INSERT INTO reseller_tiers (name, min_sensors, max_sensors, discount_pct, sort_order)
VALUES
  ('Starter',  1,     99,    0.10, 1),
  ('Bronze',   100,   499,   0.15, 2),
  ('Silver',   500,   1999,  0.22, 3),
  ('Gold',     2000,  9999,  0.30, 4),
  ('Platinum', 10000, NULL,  0.40, 5)
ON CONFLICT (name) DO NOTHING;

-- ─── Reseller tier history (audit trail) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS reseller_tier_history (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  old_tier_id     UUID         NULL REFERENCES reseller_tiers(id),
  new_tier_id     UUID         NOT NULL REFERENCES reseller_tiers(id),
  old_sensor_count INT         NULL,
  new_sensor_count INT         NULL,
  change_reason   TEXT         NULL,   -- 'daily_sync', 'manual_override', 'grace_expired'
  changed_by      UUID         NULL REFERENCES auth.users(id),
  effective_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tier_history_org
  ON reseller_tier_history (organization_id, effective_at DESC);

-- ─── Reseller sensor counts (materialized cache) ──────────────────────────────

CREATE TABLE IF NOT EXISTS reseller_sensor_counts (
  organization_id       UUID   PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  direct_sensors        INT    NOT NULL DEFAULT 0,
  downstream_sensors    INT    NOT NULL DEFAULT 0,
  effective_total       INT    NOT NULL DEFAULT 0,
  current_tier_id       UUID   NULL REFERENCES reseller_tiers(id),
  last_calculated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_tier_id          UUID   NULL REFERENCES reseller_tiers(id),
  sensors_to_next_tier  INT    NULL
);

-- ─── Sensor sync log ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sensor_sync_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  orgs_processed    INT         NOT NULL DEFAULT 0,
  tier_changes      INT         NOT NULL DEFAULT 0,
  duration_ms       INT         NULL,
  triggered_by      TEXT        NOT NULL DEFAULT 'cron',  -- 'cron' | 'manual'
  triggered_by_user UUID        NULL REFERENCES auth.users(id),
  status            TEXT        NOT NULL DEFAULT 'running', -- 'running' | 'completed' | 'failed'
  error_message     TEXT        NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ NULL
);

-- ─── PostgreSQL function: calculate_effective_sensor_count ───────────────────

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
      AND (d.status = 'online' OR d.last_heartbeat > NOW() - INTERVAL '48 hours')
    GROUP BY dl.id
  )
  SELECT
    COALESCE((SELECT sensor_count FROM sensor_counts WHERE org_id = org_id), 0) AS direct_sensors,
    COALESCE(SUM(sc.sensor_count) FILTER (WHERE sc.org_id != org_id), 0)::INT   AS downstream_sensors,
    COALESCE(SUM(sc.sensor_count), 0)::INT                                       AS effective_total
  FROM sensor_counts sc;
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE reseller_tiers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_tier_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_sensor_counts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_sync_log          ENABLE ROW LEVEL SECURITY;

-- Reseller tiers: readable by all authenticated users (global config)
CREATE POLICY "Authenticated users read tiers"
  ON reseller_tiers FOR SELECT
  USING (auth.role() = 'authenticated');

-- Super admin manages tiers
CREATE POLICY "Super admin manages tiers"
  ON reseller_tiers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role = 'super_admin'
        AND o.slug = 'netneural-demo'
    )
  );

-- Orgs read their own sensor counts
CREATE POLICY "Members read own sensor counts"
  ON reseller_sensor_counts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Tier history: members read own, super_admin reads all
CREATE POLICY "Members read own tier history"
  ON reseller_tier_history FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Sync log: super_admin only
CREATE POLICY "Super admin reads sync log"
  ON sensor_sync_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role = 'super_admin'
        AND o.slug = 'netneural-demo'
    )
  );
