-- ============================================================================
-- Fix: Re-enable DELETE on Organizations for Super Admins
-- ============================================================================
-- Issue:
--   DELETE permission is revoked on organizations table for service_role
--   This prevents even super_admin from deleting organizations
--
-- Solution:
--   Grant DELETE back, but keep RLS policies to control who can delete
-- ============================================================================

-- Grant DELETE permission back on organizations table
-- RLS will still control which organizations can be deleted based on user role
GRANT DELETE ON TABLE organizations TO service_role;
GRANT DELETE ON TABLE organizations TO authenticated;

-- Verify the policy allows super admins to delete
-- This policy should already exist from 20241201000002_rls_policies.sql:
-- CREATE POLICY "Super admins can view all organizations" ON organizations
--     FOR ALL USING (get_user_role() = 'super_admin');
-- 
-- The "FOR ALL" covers SELECT, INSERT, UPDATE, and DELETE
-- So super admins can now delete organizations

-- Test: As super_admin, you should now be able to run:
-- DELETE FROM organizations WHERE id = 'your-org-id';
