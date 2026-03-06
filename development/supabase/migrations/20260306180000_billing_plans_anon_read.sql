-- Fix #524: Allow anonymous users to read active billing plans.
-- The signup page needs to display plans before user is authenticated.
-- Without this policy, unauthenticated users fall back to hardcoded plans
-- which may have stale slugs that don't match the active DB plans.

DROP POLICY IF EXISTS "Anonymous users can read active public plans" ON public.billing_plans;
CREATE POLICY "Anonymous users can read active public plans"
  ON public.billing_plans
  FOR SELECT
  TO anon
  USING (is_active = true AND is_public = true);
