-- Migration: 20260218000005_feedback_github_resolution.sql
-- Adds github_resolution column to store closing context from GitHub issues
-- when they are synced back to the feedback table.

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS github_resolution TEXT;

COMMENT ON COLUMN feedback.github_resolution IS 'Resolution notes synced from GitHub when the linked issue is closed';
