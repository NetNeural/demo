-- ============================================================================
-- Add summary column to report_runs
-- ============================================================================
-- Shows a brief human-readable summary of what the report contained,
-- e.g. "Grade: B+ (85/100) • 15/25 roadmap done" for assessment reports.
-- ============================================================================

ALTER TABLE report_runs ADD COLUMN IF NOT EXISTS summary TEXT;

COMMENT ON COLUMN report_runs.summary IS 'Brief human-readable summary of the report output shown in Report History UI';
