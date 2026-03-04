-- Add parent_organization_id and is_reseller to admin_customer_overview
-- so the Customers table can show Plan and Reseller status separately.
-- Must DROP + CREATE because adding columns in the middle changes ordinal positions.
DROP VIEW IF EXISTS public.admin_customer_overview;

CREATE VIEW public.admin_customer_overview AS
SELECT
  o.id,
  o.name,
  o.slug,
  o.subscription_tier,
  o.is_active,
  o.created_at,
  o.updated_at AS last_updated,
  o.parent_organization_id,
  -- Is this org a reseller? (has children)
  EXISTS (SELECT 1 FROM public.organizations child WHERE child.parent_organization_id = o.id) AS is_reseller,
  -- Device count
  (SELECT COUNT(*) FROM public.devices d WHERE d.organization_id = o.id) AS device_count,
  -- Member count
  (SELECT COUNT(DISTINCT om.user_id) FROM public.organization_members om WHERE om.organization_id = o.id) AS member_count,
  -- Active devices (seen in last 24h)
  (SELECT COUNT(*) FROM public.devices d WHERE d.organization_id = o.id AND d.last_seen > now() - interval '24 hours') AS active_device_count,
  -- Subscription info
  s.id AS subscription_id,
  s.status AS subscription_status,
  s.current_period_end,
  s.cancel_at_period_end,
  -- Plan info
  bp.name AS plan_name,
  bp.slug AS plan_slug,
  bp.price_monthly AS mrr,
  -- Health score
  COALESCE(hs.score, 0) AS health_score,
  hs.login_frequency_score,
  hs.device_activity_score,
  hs.feature_adoption_score,
  hs.support_ticket_score,
  hs.payment_health_score,
  hs.computed_at AS health_computed_at,
  -- Last user login across org
  (SELECT MAX(u.last_login) FROM public.users u WHERE u.organization_id = o.id) AS last_active
FROM public.organizations o
LEFT JOIN public.subscriptions s
  ON s.organization_id = o.id
  AND s.status IN ('active', 'trialing', 'past_due')
LEFT JOIN public.billing_plans bp
  ON bp.id = s.plan_id
LEFT JOIN public.org_health_scores hs
  ON hs.organization_id = o.id;

COMMENT ON VIEW public.admin_customer_overview IS 'Aggregated customer data for super admin CRM page. Joins orgs with devices, members, subscriptions, plans, and health scores. Includes reseller info.';
