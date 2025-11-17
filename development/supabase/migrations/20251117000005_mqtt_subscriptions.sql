-- Create MQTT subscriptions table for managing topic subscriptions

CREATE TABLE IF NOT EXISTS public.mqtt_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.device_integrations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Subscription details
  topics TEXT[] NOT NULL,
  callback_url TEXT, -- Optional webhook URL for message delivery
  active BOOLEAN NOT NULL DEFAULT true,
  
  -- Stats
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_integration_sub UNIQUE (integration_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_mqtt_subscriptions_integration ON public.mqtt_subscriptions(integration_id);
CREATE INDEX IF NOT EXISTS idx_mqtt_subscriptions_active ON public.mqtt_subscriptions(active) WHERE active = true;

-- RLS
ALTER TABLE public.mqtt_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.mqtt_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Org members can view" ON public.mqtt_subscriptions FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "Org admins can manage" ON public.mqtt_subscriptions FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
