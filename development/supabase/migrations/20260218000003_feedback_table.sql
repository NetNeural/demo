-- Migration: 20260218000003_feedback_table.sql
-- Issue #41: Add in-app feedback for bug reports and feature requests
-- Creates the feedback table with org-scoped RLS

-- ============================================================================
-- 1. CREATE TYPES
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE feedback_type AS ENUM ('bug_report', 'feature_request');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE feedback_status AS ENUM ('submitted', 'acknowledged', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE feedback_severity AS ENUM ('critical', 'high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. CREATE FEEDBACK TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Feedback content
    type feedback_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    severity feedback_severity,
    
    -- GitHub integration
    github_issue_number INTEGER,
    github_issue_url TEXT,
    
    -- Status tracking
    status feedback_status NOT NULL DEFAULT 'submitted',
    
    -- Submitter context (auto-populated)
    browser_info TEXT,
    page_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_feedback_org ON feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(organization_id, created_at DESC);

-- ============================================================================
-- 4. ENABLE RLS + POLICIES
-- ============================================================================

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can view feedback from their organization
DROP POLICY IF EXISTS "feedback_select_org_members" ON feedback;
CREATE POLICY "feedback_select_org_members"
  ON feedback FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Users can insert feedback for their organization
DROP POLICY IF EXISTS "feedback_insert_org_members" ON feedback;
CREATE POLICY "feedback_insert_org_members"
  ON feedback FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Users can update their own feedback
DROP POLICY IF EXISTS "feedback_update_own" ON feedback;
CREATE POLICY "feedback_update_own"
  ON feedback FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Service role has full access (for edge function updates)
GRANT ALL ON feedback TO service_role;
GRANT SELECT, INSERT ON feedback TO authenticated;

-- ============================================================================
-- 5. AUTO-UPDATE updated_at TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feedback_updated_at ON feedback;
CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();
