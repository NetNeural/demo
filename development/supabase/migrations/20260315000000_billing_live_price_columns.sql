-- Add columns for live-mode Stripe price IDs.
-- The existing stripe_price_id_monthly / stripe_price_id_annual hold test-mode prices.
-- When billing_mode = 'live', edge functions read from the _live columns instead.

ALTER TABLE billing_plans
  ADD COLUMN IF NOT EXISTS stripe_live_price_monthly TEXT,
  ADD COLUMN IF NOT EXISTS stripe_live_price_annual  TEXT;

COMMENT ON COLUMN billing_plans.stripe_live_price_monthly IS 'Live-mode Stripe Price ID for monthly billing';
COMMENT ON COLUMN billing_plans.stripe_live_price_annual  IS 'Live-mode Stripe Price ID for annual billing';
