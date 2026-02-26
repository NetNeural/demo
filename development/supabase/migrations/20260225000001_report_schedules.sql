-- ============================================================================
-- Report Schedules & Run Log
-- ============================================================================
-- Stores configurable report schedules (daily/weekly/monthly) and logs
-- every report execution for the Executive Reports admin UI.
-- ============================================================================

-- Schedule configuration
CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('daily-report', 'assessment-report')),
  frequency TEXT NOT NULL DEFAULT 'none' CHECK (frequency IN ('none', 'daily', 'weekly', 'monthly')),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),   -- 0=Sun..6=Sat (weekly)
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 28), -- 1-28 (monthly)
  time_utc TIME NOT NULL DEFAULT '12:00:00',                   -- UTC time to send
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (report_type)
);

-- Run history / audit log
CREATE TABLE IF NOT EXISTS report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'preview', 'running')),
  triggered_by TEXT NOT NULL DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'scheduler')),
  triggered_by_user UUID REFERENCES auth.users(id),
  recipients JSONB,
  duration_ms INTEGER,
  error_message TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_report_runs_type_created ON report_runs (report_type, created_at DESC);
CREATE INDEX idx_report_schedules_enabled ON report_schedules (is_enabled) WHERE is_enabled = true;

-- Seed default schedules (disabled by default)
INSERT INTO report_schedules (report_type, frequency, time_utc, recipients, is_enabled)
VALUES
  ('daily-report', 'none', '12:00:00',
   '["heath.scheiman@netneural.ai","chris.payne@netneural.ai","mike.jordan@netneural.ai","matt.scholle@netneural.ai"]'::jsonb,
   false),
  ('assessment-report', 'none', '12:00:00',
   '["heath.scheiman@netneural.ai","chris.payne@netneural.ai","mike.jordan@netneural.ai","matt.scholle@netneural.ai"]'::jsonb,
   false)
ON CONFLICT (report_type) DO NOTHING;

-- RLS
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read schedules/runs
CREATE POLICY "Authenticated users can read report_schedules"
  ON report_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update report_schedules"
  ON report_schedules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert report_schedules"
  ON report_schedules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read report_runs"
  ON report_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert report_runs"
  ON report_runs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update report_runs"
  ON report_runs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access to report_schedules"
  ON report_schedules FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to report_runs"
  ON report_runs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
