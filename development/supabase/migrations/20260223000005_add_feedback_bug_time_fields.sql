-- Add bug report timing fields to feedback table
-- Supports issue #189: date/time entry boxes with timezone for bug reports

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS bug_occurred_date DATE,
  ADD COLUMN IF NOT EXISTS bug_occurred_time TIME,
  ADD COLUMN IF NOT EXISTS bug_timezone TEXT;

COMMENT ON COLUMN feedback.bug_occurred_date IS 'Local calendar date when bug was observed by reporter';
COMMENT ON COLUMN feedback.bug_occurred_time IS 'Local clock time when bug was observed by reporter';
COMMENT ON COLUMN feedback.bug_timezone IS 'IANA timezone selected by reporter (e.g., America/New_York)';

CREATE INDEX IF NOT EXISTS idx_feedback_bug_date
  ON feedback(organization_id, bug_occurred_date DESC);
