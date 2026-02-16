-- Fix organizations table infinite recursion
-- Date: 2026-02-16
-- Issue: Old organization policies query users table via get_user_organization_id(),
--        causing circular dependency when joining organization_members -> organizations

-- Drop ALL old organization policies that might have circular dependencies
DROP POLICY IF EXISTS "Super admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
DROP POLICY IF EXISTS "Org admins can update their organization" ON organizations;
DROP POLICY IF EXISTS "Allow access to default organization for new users" ON organizations;
DROP POLICY IF EXISTS "organizations_select_authenticated" ON organizations;
DROP POLICY IF EXISTS "organizations_update_authenticated" ON organizations;

-- Create single simple policy with NO subqueries or function calls
-- This prevents ANY circular dependencies
CREATE POLICY "organizations_select_all_authenticated" ON organizations
    FOR SELECT
    TO authenticated
    USING (true);  -- All authenticated users can view all organizations

-- Note: Organization-specific access control should be handled at the application
-- level or via organization_members table checks, not in organizations RLS
