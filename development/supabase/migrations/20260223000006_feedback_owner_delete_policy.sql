-- Migration: 20260223000006_feedback_owner_delete_policy.sql
-- Issue #186: Restrict delete permissions to tickets created by the current user

-- Tighten update policy with WITH CHECK to keep ownership bound to auth.uid()
DROP POLICY IF EXISTS "feedback_update_own" ON feedback;
CREATE POLICY "feedback_update_own"
  ON feedback FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow users to delete only their own feedback tickets
DROP POLICY IF EXISTS "feedback_delete_own" ON feedback;
CREATE POLICY "feedback_delete_own"
  ON feedback FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Ensure authenticated role can issue update/delete statements
GRANT UPDATE, DELETE ON feedback TO authenticated;
