-- Create auto_sync_schedules table for managing automated device sync schedules
-- This table stores configurations for periodic device syncs with external integrations

CREATE TABLE IF NOT EXISTS public.auto_sync_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.device_integrations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Schedule configuration
  enabled BOOLEAN NOT NULL DEFAULT true,
  frequency_minutes INTEGER NOT NULL DEFAULT 60 CHECK (frequency_minutes >= 5),
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'error', 'partial')),
  last_run_summary JSONB,
  
  -- Sync configuration
  direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK (direction IN ('import', 'export', 'bidirectional')),
  conflict_resolution TEXT NOT NULL DEFAULT 'newest_wins' CHECK (conflict_resolution IN ('newest_wins', 'local_wins', 'remote_wins', 'manual')),
  only_online BOOLEAN NOT NULL DEFAULT false,
  
  -- Time window (optional)
  time_window_enabled BOOLEAN NOT NULL DEFAULT false,
  time_window_start TIME,
  time_window_end TIME,
  
  -- Device filtering
  device_filter TEXT NOT NULL DEFAULT 'all' CHECK (device_filter IN ('all', 'tagged')),
  device_tags TEXT[],
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auto_sync_schedules_integration ON public.auto_sync_schedules(integration_id);
CREATE INDEX IF NOT EXISTS idx_auto_sync_schedules_org ON public.auto_sync_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_auto_sync_schedules_next_run ON public.auto_sync_schedules(next_run_at) WHERE enabled = true;

-- Row Level Security
ALTER TABLE public.auto_sync_schedules ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for cron jobs)
CREATE POLICY "Service role has full access"
  ON public.auto_sync_schedules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Organization members can view their schedules
CREATE POLICY "Organization members can view schedules"
  ON public.auto_sync_schedules
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Organization admins can manage schedules
CREATE POLICY "Organization admins can manage schedules"
  ON public.auto_sync_schedules
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Function to automatically update next_run_at after successful sync
CREATE OR REPLACE FUNCTION update_next_run_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_run_status = 'success' AND NEW.enabled THEN
    NEW.next_run_at := NEW.last_run_at + (NEW.frequency_minutes || ' minutes')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update next_run_at
CREATE TRIGGER auto_sync_schedules_update_next_run
  BEFORE UPDATE OF last_run_at ON public.auto_sync_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_next_run_at();

-- Function to set initial next_run_at on insert
CREATE OR REPLACE FUNCTION set_initial_next_run()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.next_run_at IS NULL AND NEW.enabled THEN
    NEW.next_run_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set initial next_run_at
CREATE TRIGGER auto_sync_schedules_set_next_run
  BEFORE INSERT ON public.auto_sync_schedules
  FOR EACH ROW
  EXECUTE FUNCTION set_initial_next_run();

-- Trigger to update updated_at
CREATE TRIGGER auto_sync_schedules_updated_at
  BEFORE UPDATE ON public.auto_sync_schedules
  FOR EACH ROW
  EXECUTE FUNCTION set_initial_next_run();

-- Comments
COMMENT ON TABLE public.auto_sync_schedules IS 'Stores automated device sync schedules for integrations';
COMMENT ON COLUMN public.auto_sync_schedules.frequency_minutes IS 'How often to run the sync (minimum 5 minutes)';
COMMENT ON COLUMN public.auto_sync_schedules.direction IS 'Sync direction: import (from integration), export (to integration), or bidirectional';
COMMENT ON COLUMN public.auto_sync_schedules.only_online IS 'Only sync devices that are currently online';
COMMENT ON COLUMN public.auto_sync_schedules.device_filter IS 'Which devices to sync: all or tagged';
COMMENT ON COLUMN public.auto_sync_schedules.device_tags IS 'Array of tags to filter devices (only used if device_filter = tagged)';
