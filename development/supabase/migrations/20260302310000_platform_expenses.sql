-- Platform Expenses: NetNeural operating cost tracker
-- Created: 2026-03-02
-- Purpose: Track and manage NetNeural's own SaaS/tooling expenses
--          Visible only to super_admins via the Billing Administration page

CREATE TABLE IF NOT EXISTS platform_expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'tooling'
                  CHECK (category IN ('infrastructure','tooling','ai','monitoring','hosting','other')),
  amount_cents  INTEGER NOT NULL DEFAULT 0,    -- monthly cost in cents
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
                  CHECK (billing_cycle IN ('monthly','annual','one-time')),
  vendor        TEXT,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_expenses_active ON platform_expenses(is_active, sort_order);

CREATE OR REPLACE FUNCTION update_platform_expenses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_platform_expenses_updated_at ON platform_expenses;
CREATE TRIGGER trg_platform_expenses_updated_at
  BEFORE UPDATE ON platform_expenses
  FOR EACH ROW EXECUTE FUNCTION update_platform_expenses_updated_at();

-- RLS — super admins only
ALTER TABLE platform_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_platform_expenses"
  ON platform_expenses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

-- Seed current known costs
INSERT INTO platform_expenses (name, category, amount_cents, billing_cycle, vendor, notes, sort_order)
VALUES
  ('Supabase Pro (×3 environments)',  'infrastructure', 12000, 'monthly', 'Supabase',  'Dev + Staging + Prod projects', 1),
  ('OpenAI API',                       'ai',             9000,  'monthly', 'OpenAI',    'AI report summaries, insights, threshold recommendations', 2),
  ('GitHub Copilot',                   'tooling',        10432, 'monthly', 'GitHub',    'Business plan — team-wide', 3),
  ('GitHub Actions + Pages',           'hosting',        2995,  'monthly', 'GitHub',    'CI/CD minutes + static hosting', 4),
  ('Sentry Team',                      'monitoring',     2600,  'monthly', 'Sentry',    'Error tracking and performance monitoring', 5)
ON CONFLICT DO NOTHING;
