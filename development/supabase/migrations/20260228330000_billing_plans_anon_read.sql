-- ============================================================================
-- Migration: Allow anonymous (unauthenticated) users to read public plans
-- Date: 2026-02-28
-- Purpose: The signup page fetches billing plans using the anon key (no auth
--          session). Without this policy, RLS blocks the read and the page
--          falls back to hardcoded defaults, so admin pricing changes never
--          appear on the customer-facing signup page.
-- ============================================================================

-- Anonymous users can read active + public plans (for signup/pricing pages)
DROP POLICY IF EXISTS "Anyone can read public active plans" ON public.billing_plans;
CREATE POLICY "Anyone can read public active plans"
  ON public.billing_plans
  FOR SELECT
  TO anon
  USING (is_active = true AND is_public = true);
