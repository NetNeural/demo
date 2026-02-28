-- #314: Price change audit log table
-- Tracks pricing adjustments for inflation and plan modifications

-- ============================================================================
-- Table: price_change_log
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.price_change_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES public.billing_plans(id) ON DELETE CASCADE,
  plan_slug       TEXT NOT NULL,
  field_changed   TEXT NOT NULL CHECK (field_changed IN ('price_per_device', 'price_monthly', 'price_annual')),
  old_value       NUMERIC(10, 2) NOT NULL,
  new_value       NUMERIC(10, 2) NOT NULL,
  scope           TEXT NOT NULL DEFAULT 'new_only' CHECK (scope IN ('all', 'new_only')),
  reason          TEXT,
  effective_date  DATE DEFAULT CURRENT_DATE,
  notification_sent BOOLEAN DEFAULT false,
  notification_message TEXT,
  changed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.price_change_log IS 'Audit trail for billing plan price changes (inflation adjustments, plan modifications).';

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_price_change_log_plan_id ON public.price_change_log(plan_id);
CREATE INDEX IF NOT EXISTS idx_price_change_log_created_at ON public.price_change_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_change_log_changed_by ON public.price_change_log(changed_by);

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.price_change_log ENABLE ROW LEVEL SECURITY;

-- Only super admins and service role can read/write
CREATE POLICY "Service role full access on price_change_log"
  ON public.price_change_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users with admin roles can read
CREATE POLICY "Admins can read price change log"
  ON public.price_change_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users with admin roles can insert
CREATE POLICY "Admins can insert price change log"
  ON public.price_change_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
