-- =============================================================================
-- Migration: API rate limiting + webhook subscriptions (#389, #388)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. API USAGE LOG — sliding-window rate limit tracking per key
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_usage_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id    UUID        NOT NULL REFERENCES public.organization_api_keys(id) ON DELETE CASCADE,
  organization_id UUID      NOT NULL,
  endpoint      TEXT        NOT NULL,   -- e.g. 'telemetry', 'devices', 'alerts'
  status_code   INT         NOT NULL DEFAULT 200,
  response_ms   INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_usage_key_time
  ON public.api_usage_log(api_key_id, created_at DESC);

CREATE INDEX idx_api_usage_org_time
  ON public.api_usage_log(organization_id, created_at DESC);

-- Auto-purge rows older than 7 days (keep table small)
CREATE OR REPLACE FUNCTION prune_api_usage_log()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.api_usage_log WHERE created_at < now() - INTERVAL '7 days';
END;
$$;

-- RLS
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view API usage"
  ON public.api_usage_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = api_usage_log.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. WEBHOOK SUBSCRIPTIONS — outbound event delivery (#388)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  url             TEXT        NOT NULL,
  secret          TEXT        NOT NULL,   -- HMAC-SHA256 signing secret (stored hashed in Vault in prod)
  event_types     TEXT[]      NOT NULL DEFAULT '{alert.created,alert.resolved}',
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_status_code  INT,
  failure_count   INT         NOT NULL DEFAULT 0,
  created_by      UUID        REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_subs_org
  ON public.webhook_subscriptions(organization_id, is_active);

-- Delivery log — keep last 500 deliveries per subscription
CREATE TABLE IF NOT EXISTS public.webhook_delivery_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id     UUID        NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  event_type          TEXT        NOT NULL,
  payload             JSONB       NOT NULL,
  response_status     INT,
  response_body       TEXT,
  duration_ms         INT,
  delivered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  success             BOOLEAN     NOT NULL DEFAULT false
);

CREATE INDEX idx_webhook_delivery_sub
  ON public.webhook_delivery_log(subscription_id, delivered_at DESC);

-- Auto-purge delivery log older than 30 days
CREATE OR REPLACE FUNCTION prune_webhook_delivery_log()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.webhook_delivery_log WHERE delivered_at < now() - INTERVAL '30 days';
END;
$$;

-- RLS
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage webhooks"
  ON public.webhook_subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = webhook_subscriptions.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

CREATE POLICY "Org admins can view delivery log"
  ON public.webhook_delivery_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.webhook_subscriptions ws
      JOIN public.organization_members om ON om.organization_id = ws.organization_id
      WHERE ws.id = webhook_delivery_log.subscription_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_webhook_subscriptions_updated_at()
RETURNS TRIGGER AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_webhook_subscriptions_updated_at ON public.webhook_subscriptions;
CREATE TRIGGER trg_webhook_subscriptions_updated_at
  BEFORE UPDATE ON public.webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_webhook_subscriptions_updated_at();
