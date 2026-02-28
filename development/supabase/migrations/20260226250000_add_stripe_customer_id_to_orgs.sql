-- #241: Add stripe_customer_id to organizations for easier portal lookup
-- The subscriptions table also stores it, but having it on the org
-- makes portal session creation simpler and avoids extra joins.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

COMMENT ON COLUMN public.organizations.stripe_customer_id
  IS 'Stripe Customer ID for billing portal. Set by checkout/webhook handlers.';

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id
  ON public.organizations(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
