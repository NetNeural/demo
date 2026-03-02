-- #379: Sync organizations.subscription_tier from active billing subscription
-- Root cause: orgs created with subscription_tier='free' (legacy) were never
-- updated when billing admin assigned a subscription plan through paths other
-- than BillingOperationsTab change_plan (e.g. direct inserts, signup flow).
--
-- Step 1: For orgs that have an active subscription, sync subscription_tier
--         from the billing_plan slug (maps directly: starter→starter, etc.)
UPDATE public.organizations o
SET subscription_tier = bp.slug
FROM public.subscriptions s
JOIN public.billing_plans bp ON bp.id = s.plan_id
WHERE s.organization_id = o.id
  AND s.status IN ('active', 'trialing')
  AND bp.slug IN ('starter', 'professional', 'enterprise', 'unlimited')
  AND o.subscription_tier != bp.slug;

-- Step 2: Any remaining orgs still on 'free' (no active subscription) → 'starter'
-- 'free' is a legacy tier that no longer exists as a valid billing plan.
UPDATE public.organizations
SET subscription_tier = 'starter'
WHERE subscription_tier = 'free';
