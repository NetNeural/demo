-- ============================================================
-- Migration: Project Hydra – Billing Splits, Grace Period,
--            Floor Price Enforcement, Settings
-- Stories: #329, #331, #332
-- ============================================================

-- ─── Global reseller settings (NetNeural-configurable) ───────────────────────

CREATE TABLE IF NOT EXISTS reseller_settings (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Floor price: NetNeural minimum retained revenue (default 50%)
  floor_price_pct           NUMERIC(5,4) NOT NULL DEFAULT 0.50,
  floor_price_min           NUMERIC(5,4) NOT NULL DEFAULT 0.40, -- admin guardrail min
  floor_price_max           NUMERIC(5,4) NOT NULL DEFAULT 0.70, -- admin guardrail max
  -- Grace period duration in days
  grace_period_days         INT          NOT NULL DEFAULT 30,
  -- Heartbeat window for active sensor detection
  heartbeat_window_hours    INT          NOT NULL DEFAULT 48,
  -- Support fee defaults per support model
  support_fee_hybrid_pct    NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  support_fee_netneural_pct NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by                UUID         NULL REFERENCES auth.users(id)
);

-- Single-row settings (upsert by id)
INSERT INTO reseller_settings (id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ─── Reseller payouts ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reseller_payouts (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        TEXT         NULL,              -- Stripe invoice id
  organization_id   UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payout_amount     NUMERIC(10,2) NOT NULL,
  spread_pct        NUMERIC(5,4)  NOT NULL,
  sensor_count      INT           NOT NULL DEFAULT 0,
  subscription_price NUMERIC(10,2) NOT NULL,
  status            TEXT          NOT NULL DEFAULT 'pending', -- 'pending'|'paid'|'failed'
  period_start      TIMESTAMPTZ   NULL,
  period_end        TIMESTAMPTZ   NULL,
  calculated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  paid_at           TIMESTAMPTZ   NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reseller_payouts_org
  ON reseller_payouts (organization_id, calculated_at DESC);

-- ─── Commission / billing split audit log ────────────────────────────────────

CREATE TABLE IF NOT EXISTS reseller_commission_log (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id    UUID         NOT NULL DEFAULT gen_random_uuid(),
  selling_org_id    UUID         NOT NULL REFERENCES organizations(id),
  reseller_org_id   UUID         NOT NULL REFERENCES organizations(id),
  depth_in_chain    INT          NOT NULL DEFAULT 0,
  parent_discount   NUMERIC(5,4) NOT NULL,
  child_discount    NUMERIC(5,4) NOT NULL,
  spread_pct        NUMERIC(5,4) NOT NULL,
  subscription_price NUMERIC(10,2) NOT NULL,
  payout_amount     NUMERIC(10,2) NOT NULL,
  floor_applied     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_log_reseller
  ON reseller_commission_log (reseller_org_id, created_at DESC);

-- ─── Floor price violations log ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reseller_floor_violations (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_root_org_id UUID         NOT NULL REFERENCES organizations(id),
  aggregate_discount NUMERIC(5,4) NOT NULL,
  floor_pct         NUMERIC(5,4) NOT NULL,
  adjusted          BOOLEAN      NOT NULL DEFAULT TRUE,
  detected_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─── Grace period: notification log ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reseller_grace_notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  notification_type TEXT      NOT NULL, -- 'grace_started'|'7_days_remaining'|'1_day_remaining'|'tier_downgraded'
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  tier_locked_until TIMESTAMPTZ NULL,
  old_tier        TEXT        NULL,
  new_tier        TEXT        NULL
);

CREATE INDEX IF NOT EXISTS idx_grace_notifications_org
  ON reseller_grace_notifications (organization_id, sent_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE reseller_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_payouts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_commission_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_floor_violations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_grace_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read reseller_settings"
  ON reseller_settings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Super admin manages reseller_settings"
  ON reseller_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role = 'super_admin'
        AND o.slug = 'netneural-demo'
    )
  );

CREATE POLICY "Members read own payouts"
  ON reseller_payouts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members read own commission log"
  ON reseller_commission_log FOR SELECT
  USING (
    reseller_org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members read own grace notifications"
  ON reseller_grace_notifications FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admin reads violations"
  ON reseller_floor_violations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role = 'super_admin'
        AND o.slug = 'netneural-demo'
    )
  );
