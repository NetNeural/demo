-- Automatic Timestamp Triggers Migration
-- Created: 2025-01-13
-- Purpose: Automatically update updated_at timestamps on row modifications

-- ============================================================================
-- Create trigger function
-- ============================================================================

-- This function will be called by triggers to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION update_updated_at_column() IS 
  'Automatically updates the updated_at column to the current timestamp when a row is modified';

-- ============================================================================
-- Apply triggers to all tables with updated_at column
-- ============================================================================

-- Organizations table
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Device integrations table
DROP TRIGGER IF EXISTS update_device_integrations_updated_at ON device_integrations;
CREATE TRIGGER update_device_integrations_updated_at
  BEFORE UPDATE ON device_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Locations table
DROP TRIGGER IF EXISTS update_locations_updated_at ON locations;
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Departments table
DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Devices table
DROP TRIGGER IF EXISTS update_devices_updated_at ON devices;
CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Alerts table
DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Benefits of this approach
-- ============================================================================

/*
1. Consistency: No need to remember to update updated_at in application code
2. Reliability: Timestamps are always accurate, can't be forgotten or set incorrectly
3. Performance: Trigger runs at database level, very efficient
4. Audit Trail: Automatic tracking of when records were last modified
5. Simplicity: Application code doesn't need to manage timestamps

Example: Before and After

BEFORE (Manual):
  UPDATE devices 
  SET status = 'online', updated_at = NOW() 
  WHERE id = '...';

AFTER (Automatic):
  UPDATE devices 
  SET status = 'online' 
  WHERE id = '...';
  -- updated_at is automatically set by trigger!

*/

-- ============================================================================
-- Verification query
-- ============================================================================

-- You can verify triggers are installed with this query:
/*
SELECT 
  event_object_table AS table_name,
  trigger_name,
  event_manipulation AS event,
  action_timing AS timing,
  action_statement AS function
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND action_statement LIKE '%update_updated_at_column%'
ORDER BY table_name;
*/
