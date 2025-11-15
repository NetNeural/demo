-- =====================================================
-- FIX MISSING GRANTS - Production Issue
-- =====================================================
-- The 20251106120000_rls_fix_production_safe migration ran
-- but the GRANT statements didn't take effect in production.
-- 
-- Root cause: Production has NO grants on devices table for
-- authenticated or service_role, while local has all grants.
--
-- This migration re-applies all necessary grants to fix
-- production device sync (0 devices imported despite 29 successful
-- sync operations).
-- =====================================================

-- =====================================================
-- GRANT PERMISSIONS TO AUTHENTICATED AND SERVICE_ROLE
-- =====================================================

-- Users table permissions
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT ALL ON users TO service_role;

-- Organizations table permissions
GRANT SELECT ON organizations TO authenticated;
GRANT ALL ON organizations TO service_role;

-- Organization Members table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_members TO authenticated;
GRANT ALL ON organization_members TO service_role;

-- Device Integrations table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON device_integrations TO authenticated;
GRANT ALL ON device_integrations TO service_role;

-- Locations table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON locations TO authenticated;
GRANT ALL ON locations TO service_role;

-- Departments table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON departments TO authenticated;
GRANT ALL ON departments TO service_role;

-- Devices table permissions (THE CRITICAL FIX)
GRANT SELECT, INSERT, UPDATE, DELETE ON devices TO authenticated;
GRANT ALL ON devices TO service_role;

-- Device Data table permissions
GRANT SELECT ON device_data TO authenticated;
GRANT ALL ON device_data TO service_role;

-- Alerts table permissions
GRANT SELECT, UPDATE ON alerts TO authenticated;
GRANT ALL ON alerts TO service_role;

-- Notifications table permissions
GRANT SELECT ON notifications TO authenticated;
GRANT ALL ON notifications TO service_role;

-- Audit Log table permissions (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        GRANT SELECT ON audit_logs TO authenticated;
        GRANT ALL ON audit_logs TO service_role;
    END IF;
END $$;

-- MQTT Messages table permissions (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'mqtt_messages') THEN
        GRANT SELECT ON mqtt_messages TO authenticated;
        GRANT ALL ON mqtt_messages TO service_role;
    END IF;
END $$;

-- Notification Log table permissions (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_log') THEN
        GRANT SELECT ON notification_log TO authenticated;
        GRANT ALL ON notification_log TO service_role;
    END IF;
END $$;

-- Integration Activity Log table permissions (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'integration_activity_log') THEN
        GRANT SELECT ON integration_activity_log TO authenticated;
        GRANT ALL ON integration_activity_log TO service_role;
    END IF;
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- After running this migration, verify with:
-- SELECT grantee, privilege_type 
-- FROM information_schema.table_privileges 
-- WHERE table_name = 'devices' 
-- AND grantee IN ('authenticated', 'service_role')
-- ORDER BY grantee, privilege_type;
--
-- Expected: 
-- authenticated: DELETE, INSERT, SELECT, UPDATE
-- service_role: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
-- =====================================================
