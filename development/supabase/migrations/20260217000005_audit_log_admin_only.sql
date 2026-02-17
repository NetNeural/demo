-- Update RLS policy for user_audit_log to admin-only access
-- Story 1.4: User Activity Audit Log - Admin Only Access

BEGIN;

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view audit logs in their organization" ON user_audit_log;

-- Create new admin-only policy
-- Only super_admin and org_owner can view audit logs
CREATE POLICY "Admin users can view audit logs in their organization"
    ON user_audit_log FOR SELECT
    USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om
            JOIN users u ON u.id = om.user_id
            WHERE om.user_id = auth.uid()
            AND (
                u.role = 'super_admin' 
                OR om.role = 'owner'
            )
        )
    );

COMMIT;

-- Note: This ensures only administrators (super_admin or organization owners) can view audit logs
-- Regular users and members will not have access to audit log data
