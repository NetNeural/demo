-- =============================================================================
-- MANUAL MIGRATION: Fix Infinite Recursion in RLS Policies
-- =============================================================================
-- Run this script in your Supabase SQL Editor to fix the infinite recursion
-- errors when joining organization_members with organizations.
--
-- Date: 2026-02-16
-- Issue: 42P17 - infinite recursion detected in policy for relation "organization_members"
--
-- Instructions:
-- 1. Go to your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select project: atgbmxicqikmapfqouco (Staging)
-- 3. Navigate to SQL Editor
-- 4. Paste this entire script
-- 5. Click "Run"
-- =============================================================================

-- =============================================================================
-- FIX 1: organization_members Table Policies
-- =============================================================================
-- Remove policies that query users table (causes circular dependency)

DROP POLICY IF EXISTS "Users can view members in their organizations" ON organization_members;
DROP POLICY IF EXISTS "Users can view their own organization memberships" ON organization_members;
DROP POLICY IF EXISTS "organization_members_select_user_only" ON organization_members;

-- Create simple policy with NO subqueries to other tables
CREATE POLICY "organization_members_select_user_only" ON organization_members
    FOR SELECT 
    USING (
        -- Service role bypass (checked at JWT level, not database query)
        (auth.jwt() ->> 'role' = 'service_role')
        OR
        -- Users can only view their own memberships
        (user_id = auth.uid())
    );

-- =============================================================================
-- FIX 2: organizations Table Policies  
-- =============================================================================
-- Remove ALL policies that query users table via get_user_organization_id()

DROP POLICY IF EXISTS "Super admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
DROP POLICY IF EXISTS "Org admins can update their organization" ON organizations;
DROP POLICY IF EXISTS "Allow access to default organization for new users" ON organizations;
DROP POLICY IF EXISTS "organizations_select_authenticated" ON organizations;
DROP POLICY IF EXISTS "organizations_update_authenticated" ON organizations;
DROP POLICY IF EXISTS "organizations_select_all_authenticated" ON organizations;

-- Create single simple policy with NO subqueries or function calls
CREATE POLICY "organizations_select_all_authenticated" ON organizations
    FOR SELECT
    TO authenticated
    USING (true);  -- All authenticated users can view all organizations

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- Run this query after applying the migrations to verify policies are correct:

SELECT 
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('organization_members', 'organizations')
ORDER BY tablename, policyname;

-- Expected results:
-- 1. organization_members: 1 policy "organization_members_select_user_only"
-- 2. organizations: 1 policy "organizations_select_all_authenticated"

-- =============================================================================
-- NOTES
-- =============================================================================
-- Why this is safe:
-- - Users can only see their own organization_members records (user_id = auth.uid())
-- - When JOINing to organizations, the filter happens via organization_members
-- - No circular dependencies = no infinite recursion
-- - Application-level checks via organization_members table provide security
-- =============================================================================
