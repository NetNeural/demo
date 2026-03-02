-- #378: Allow super_admins to read all subscriptions and invoices
-- Previously only org members could read their own org's subscription,
-- causing Billing Administration → Subscriptions tab to show only 1 row.

-- Subscriptions: super_admin read-all policy
DROP POLICY IF EXISTS "Super admins can read all subscriptions" ON public.subscriptions;
CREATE POLICY "Super admins can read all subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Invoices: super_admin read-all policy
DROP POLICY IF EXISTS "Super admins can read all invoices" ON public.invoices;
CREATE POLICY "Super admins can read all invoices"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );
