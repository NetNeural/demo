-- #378: Allow super_admins to read all subscriptions and invoices
-- Previously only org members could read their own org's subscription,
-- causing Billing Administration → Subscriptions tab to show only 1 row.

-- Subscriptions: super_admin read-all policy
DROP POLICY IF EXISTS "Super admins can read all subscriptions" ON public.subscriptions;
CREATE POLICY "Super admins can read all subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (get_user_role() = 'super_admin');

-- Invoices: super_admin read-all policy
DROP POLICY IF EXISTS "Super admins can read all invoices" ON public.invoices;
CREATE POLICY "Super admins can read all invoices"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (get_user_role() = 'super_admin');
