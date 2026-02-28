-- ============================================================================
-- Migration: Add super_admin RLS policies for billing_plans
-- Date: 2026-02-28
-- Purpose: Allow super_admin users to manage plans from the admin UI
--
-- Problem: billing_plans only had SELECT for authenticated + ALL for
--          service_role. The admin page uses the anon/authenticated client,
--          so UPDATEs (e.g., renaming a plan) were silently blocked.
-- ============================================================================

-- 1. Super admins can manage (INSERT, UPDATE, DELETE) billing plans
DROP POLICY IF EXISTS "Super admins can manage billing plans" ON public.billing_plans;
CREATE POLICY "Super admins can manage billing plans"
  ON public.billing_plans
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'super_admin'
    )
  );

-- 2. Broaden the SELECT policy so admins can also see inactive/legacy plans
--    (needed for the "Inactive / Legacy Plans" section on the admin page)
DROP POLICY IF EXISTS "Authenticated users can read active plans" ON public.billing_plans;
CREATE POLICY "Authenticated users can read active plans"
  ON public.billing_plans
  FOR SELECT
  TO authenticated
  USING (true);  -- all plans readable; the UI filters active vs inactive

-- Keep service_role full access as-is (no change needed)
