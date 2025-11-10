-- Create auto_sync_schedules table for automated device synchronization
CREATE TABLE IF NOT EXISTS auto_sync_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES device_integrations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Basic Configuration
  enabled BOOLEAN NOT NULL DEFAULT false,
  frequency_minutes INTEGER NOT NULL DEFAULT 15,
  
  -- Sync Options
  direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK (direction IN ('import', 'export', 'bidirectional')),
  conflict_resolution TEXT NOT NULL DEFAULT 'newest_wins' CHECK (conflict_resolution IN ('newest_wins', 'local_wins', 'remote_wins', 'manual')),
  
  -- Conditions
  only_online BOOLEAN NOT NULL DEFAULT true,
  time_window_enabled BOOLEAN NOT NULL DEFAULT false,
  time_window_start TIME,
  time_window_end TIME,
  
  -- Device Filtering
  device_filter TEXT NOT NULL DEFAULT 'all' CHECK (device_filter IN ('all', 'tagged')),
  device_tags TEXT[], -- Array of tag names to filter by
  
  -- Execution Tracking
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'partial', 'failed')),
  last_run_summary JSONB, -- { synced: N, created: N, updated: N, skipped: N, errors: N }
  next_run_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  UNIQUE(integration_id),
  CONSTRAINT valid_time_window CHECK (
    (NOT time_window_enabled) OR 
    (time_window_start IS NOT NULL AND time_window_end IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_auto_sync_schedules_integration_id ON auto_sync_schedules(integration_id);
CREATE INDEX idx_auto_sync_schedules_organization_id ON auto_sync_schedules(organization_id);
CREATE INDEX idx_auto_sync_schedules_enabled ON auto_sync_schedules(enabled);
CREATE INDEX idx_auto_sync_schedules_next_run ON auto_sync_schedules(next_run_at) WHERE enabled = true;

-- Function to calculate next run time
CREATE OR REPLACE FUNCTION calculate_next_run(
  p_frequency_minutes INTEGER,
  p_time_window_enabled BOOLEAN,
  p_time_window_start TIME,
  p_time_window_end TIME
) RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_next_run TIMESTAMPTZ;
  v_current_time TIME;
BEGIN
  -- Calculate basic next run (current time + frequency)
  v_next_run := NOW() + (p_frequency_minutes || ' minutes')::INTERVAL;
  
  -- If time window is enabled, adjust next run to fall within window
  IF p_time_window_enabled AND p_time_window_start IS NOT NULL AND p_time_window_end IS NOT NULL THEN
    v_current_time := v_next_run::TIME;
    
    -- If next run is outside window, push to start of next window
    IF v_current_time < p_time_window_start THEN
      v_next_run := DATE_TRUNC('day', v_next_run) + p_time_window_start::INTERVAL;
    ELSIF v_current_time > p_time_window_end THEN
      v_next_run := DATE_TRUNC('day', v_next_run) + INTERVAL '1 day' + p_time_window_start::INTERVAL;
    END IF;
  END IF;
  
  RETURN v_next_run;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate next_run_at
CREATE OR REPLACE FUNCTION update_auto_sync_next_run()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.enabled = true THEN
    NEW.next_run_at := calculate_next_run(
      NEW.frequency_minutes,
      NEW.time_window_enabled,
      NEW.time_window_start,
      NEW.time_window_end
    );
  ELSE
    NEW.next_run_at := NULL;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_auto_sync_next_run
  BEFORE INSERT OR UPDATE ON auto_sync_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_auto_sync_next_run();

-- RLS Policies
ALTER TABLE auto_sync_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view auto-sync schedules for their organization"
  ON auto_sync_schedules
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage auto-sync schedules for their organization"
  ON auto_sync_schedules
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON auto_sync_schedules TO authenticated;

-- Add comment
COMMENT ON TABLE auto_sync_schedules IS 'Automated device synchronization schedules for integrations';
