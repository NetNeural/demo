-- =============================================================================
-- Production Database Schema Reset
-- =============================================================================
-- WARNING: This will DROP ALL existing tables and data in the public schema
-- A backup has been created in backups/production_backup_20251014_021430.sql
--
-- This script will:
-- 1. Drop all existing tables, views, and policies
-- 2. Drop all custom types
-- 3. Apply the IoT member management schema from migrations
--
-- To restore if needed:
-- psql -d your_database < backups/production_backup_20251014_021430.sql
-- =============================================================================

-- Disable RLS temporarily
ALTER TABLE IF EXISTS public.alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.files DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sensor_readings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sensors DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.device_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.device_integrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;

-- Drop all policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || 
                ' ON public.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- Drop all triggers
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT trigger_name, event_object_table 
        FROM information_schema.triggers 
        WHERE trigger_schema = 'public'
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || 
                ' ON public.' || quote_ident(r.event_object_table) || ' CASCADE';
    END LOOP;
END $$;

-- Drop all tables (CASCADE to drop dependencies)
DROP TABLE IF EXISTS public.task_comments CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.files CASCADE;
DROP TABLE IF EXISTS public.project_members CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.sensor_readings CASCADE;
DROP TABLE IF EXISTS public.sensors CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.organization_members CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.locations CASCADE;
DROP TABLE IF EXISTS public.alerts CASCADE;
DROP TABLE IF EXISTS public.device_integrations CASCADE;
DROP TABLE IF EXISTS public.device_data CASCADE;
DROP TABLE IF EXISTS public.devices CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop all custom types
DROP TYPE IF EXISTS public.file_category CASCADE;
DROP TYPE IF EXISTS public.task_priority CASCADE;
DROP TYPE IF EXISTS public.task_status CASCADE;
DROP TYPE IF EXISTS public.alert_severity CASCADE;
DROP TYPE IF EXISTS public.device_status CASCADE;
DROP TYPE IF EXISTS public.notification_method CASCADE;
DROP TYPE IF EXISTS public.notification_status CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS public.handle_new_organization_member() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_project() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_organization_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.update_device_integrations_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Verify clean slate
SELECT 'Tables remaining: ' || COUNT(*) as status 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

SELECT 'Types remaining: ' || COUNT(*) as status 
FROM pg_type 
WHERE typnamespace = 'public'::regnamespace;

-- Database is now clean and ready for migrations
-- Run: npx supabase db push --linked
