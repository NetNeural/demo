-- #241: Idempotency table for Stripe webhook events
-- Prevents duplicate processing when Stripe retries delivery.

CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type      TEXT,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.processed_stripe_events
  IS 'Idempotency guard: tracks Stripe event IDs already processed by webhook handler.';

CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_event_id
  ON public.processed_stripe_events(stripe_event_id);

-- Auto-clean old events after 90 days (optional cron)
-- No RLS — service role only
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;
