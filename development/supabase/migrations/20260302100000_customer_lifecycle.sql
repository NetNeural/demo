-- #57: Customer lifecycle tracking with stage transitions and timeline
-- Adds lifecycle_stage to organizations + event log table for transitions
-- Depends on: organizations, org_health_scores (#56)

-- ============================================================================
-- Enum: customer_lifecycle_stage
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.customer_lifecycle_stage AS ENUM (
    'trial',
    'onboarding',
    'active',
    'at_risk',
    'churned',
    'reactivated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Add lifecycle columns to organizations
-- ============================================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS lifecycle_stage public.customer_lifecycle_stage DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS lifecycle_stage_changed_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_organizations_lifecycle_stage
  ON public.organizations(lifecycle_stage);

-- ============================================================================
-- Table: customer_lifecycle_events
-- Append-only log of all stage transitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customer_lifecycle_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_stage        public.customer_lifecycle_stage,
  to_stage          public.customer_lifecycle_stage NOT NULL,
  trigger_type      VARCHAR(50) NOT NULL CHECK (trigger_type IN ('automatic', 'manual', 'system')),
  trigger_reason    TEXT,
  metadata          JSONB DEFAULT '{}',
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.customer_lifecycle_events IS 'Append-only log of customer lifecycle stage transitions. Tracks automatic, manual, and system-triggered changes.';

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_org
  ON public.customer_lifecycle_events(organization_id);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_date
  ON public.customer_lifecycle_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_to_stage
  ON public.customer_lifecycle_events(to_stage);

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.customer_lifecycle_events ENABLE ROW LEVEL SECURITY;

-- Super admins can read all lifecycle events
DROP POLICY IF EXISTS "Super admins can read lifecycle events" ON public.customer_lifecycle_events;
CREATE POLICY "Super admins can read lifecycle events"
  ON public.customer_lifecycle_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- Org members can read their own lifecycle events
DROP POLICY IF EXISTS "Org members can read own lifecycle events" ON public.customer_lifecycle_events;
CREATE POLICY "Org members can read own lifecycle events"
  ON public.customer_lifecycle_events
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Super admins can insert (manual overrides)
DROP POLICY IF EXISTS "Super admins can insert lifecycle events" ON public.customer_lifecycle_events;
CREATE POLICY "Super admins can insert lifecycle events"
  ON public.customer_lifecycle_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- Service role has full access (edge function writes)
DROP POLICY IF EXISTS "Service role full access on lifecycle events" ON public.customer_lifecycle_events;
CREATE POLICY "Service role full access on lifecycle events"
  ON public.customer_lifecycle_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
