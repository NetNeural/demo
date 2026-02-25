-- ============================================================================
-- MIRROR STAGING DATA TO TARGET ENVIRONMENT (Dev / Prod)
-- ============================================================================
-- Run this in the Supabase SQL Editor for:
--   DEV:  https://supabase.com/dashboard/project/tsomafkalaoarnuwgdyu/sql
--   PROD: https://supabase.com/dashboard/project/bldojxpockljyivldxwf/sql
--
-- This script is IDEMPOTENT - safe to run multiple times.
-- It creates the same users, org, devices, etc. that staging has.
-- ============================================================================

-- ====================== STEP 1: Auth Users ==================================
-- Create the 4 test users in Supabase Auth (auth.users + auth.identities)
-- These are required for login to work.
-- Passwords: superadmin = SuperSecure123!, others = password123
-- ============================================================================

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token, is_sso_user
) VALUES
  -- Super Admin (superadmin@netneural.ai / SuperSecure123!)
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated',
   'superadmin@netneural.ai',
   crypt('SuperSecure123!', gen_salt('bf')),
   NOW(), NOW(),
   '{"provider": "email", "providers": ["email"]}',
   '{"name": "Super Admin", "role": "super_admin"}',
   NULL, NOW(), NOW(), '', '', '', '', '', '', '', '', false),

  -- Org Admin (admin@netneural.ai / password123)
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated',
   'admin@netneural.ai',
   crypt('password123', gen_salt('bf')),
   NOW(), NOW(),
   '{"provider": "email", "providers": ["email"]}',
   '{"name": "Admin User", "role": "org_owner"}',
   NULL, NOW(), NOW(), '', '', '', '', '', '', '', '', false),

  -- Regular User (user@netneural.ai / password123)
  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated',
   'user@netneural.ai',
   crypt('password123', gen_salt('bf')),
   NOW(), NOW(),
   '{"provider": "email", "providers": ["email"]}',
   '{"name": "Regular User", "role": "user"}',
   NULL, NOW(), NOW(), '', '', '', '', '', '', '', '', false),

  -- Viewer (viewer@netneural.ai / password123)
  ('00000000-0000-0000-0000-000000000000',
   '44444444-4444-4444-4444-444444444444',
   'authenticated', 'authenticated',
   'viewer@netneural.ai',
   crypt('password123', gen_salt('bf')),
   NOW(), NOW(),
   '{"provider": "email", "providers": ["email"]}',
   '{"name": "Viewer User", "role": "viewer"}',
   NULL, NOW(), NOW(), '', '', '', '', '', '', '', '', false)
ON CONFLICT (id) DO NOTHING;

-- Auth identities (required for email login to work)
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '{"sub": "11111111-1111-1111-1111-111111111111", "email": "superadmin@netneural.ai"}', 'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   '{"sub": "22222222-2222-2222-2222-222222222222", "email": "admin@netneural.ai"}', 'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333',
   '{"sub": "33333333-3333-3333-3333-333333333333", "email": "user@netneural.ai"}', 'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444',
   '{"sub": "44444444-4444-4444-4444-444444444444", "email": "viewer@netneural.ai"}', 'email', NOW(), NOW(), NOW())
ON CONFLICT (provider, provider_id) DO NOTHING;


-- ====================== STEP 2: Organization ================================
INSERT INTO organizations (id, name, slug, description, subscription_tier, is_active, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'NetNeural Demo',
  'netneural-demo',
  'Demo organization for NetNeural IoT Platform',
  'enterprise',
  true,
  '{}'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  subscription_tier = EXCLUDED.subscription_tier,
  is_active = EXCLUDED.is_active;


-- ====================== STEP 3: Public Users ================================
INSERT INTO users (id, email, full_name, role, organization_id, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'superadmin@netneural.ai', 'Super Admin', 'super_admin', '00000000-0000-0000-0000-000000000001', true),
  ('22222222-2222-2222-2222-222222222222', 'admin@netneural.ai', 'Admin User', 'org_owner', '00000000-0000-0000-0000-000000000001', true),
  ('33333333-3333-3333-3333-333333333333', 'user@netneural.ai', 'Regular User', 'user', '00000000-0000-0000-0000-000000000001', true),
  ('44444444-4444-4444-4444-444444444444', 'viewer@netneural.ai', 'Viewer User', 'viewer', '00000000-0000-0000-0000-000000000001', true)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  organization_id = EXCLUDED.organization_id,
  is_active = EXCLUDED.is_active;


-- ====================== STEP 4: Organization Members ========================
INSERT INTO organization_members (organization_id, user_id, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'owner'),
  ('00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'member'),
  ('00000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'member')
ON CONFLICT (organization_id, user_id) DO NOTHING;


-- ====================== STEP 5: Locations ===================================
INSERT INTO locations (id, organization_id, name, description, address, city, state, country, postal_code, latitude, longitude)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Main Facility', 'Primary manufacturing facility', '123 Industrial Blvd', 'Tech City', 'CA', 'USA', '90210', 34.0522, -118.2437),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Warehouse A', 'Storage and distribution center', '456 Storage Ave', 'Tech City', 'CA', 'USA', '90211', 34.0523, -118.2438)
ON CONFLICT (id) DO NOTHING;


-- ====================== STEP 6: Departments =================================
INSERT INTO departments (id, location_id, name, description, floor_level, area_square_feet)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Production Floor', 'Main manufacturing area', 1, 10000.00),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Quality Control', 'Testing and inspection area', 1, 2000.00),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Storage Area', 'Inventory storage', 1, 15000.00)
ON CONFLICT (id) DO NOTHING;


-- ====================== STEP 7: Device Integration ==========================
INSERT INTO device_integrations (id, organization_id, integration_type, name, project_id, settings, status)
VALUES
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'golioth', 'Golioth Integration', 'demo-project', '{"sync_interval": 300, "data_retention_days": 30}', 'active')
ON CONFLICT (id) DO NOTHING;


-- ====================== STEP 8: Devices =====================================
INSERT INTO devices (id, organization_id, integration_id, external_device_id, name, device_type, model, serial_number, status, last_seen, battery_level, signal_strength, firmware_version, location_id, department_id, metadata) VALUES
('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-001', 'Temperature Sensor 1', 'temperature_sensor', 'TS-2000', 'TS001234', 'online', NOW() - INTERVAL '5 minutes', 87, -45, '1.2.3', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{"calibration_date": "2024-01-15", "accuracy": "±0.1°C"}'),
('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-002', 'Humidity Sensor 1', 'humidity_sensor', 'HS-1500', 'HS001235', 'online', NOW() - INTERVAL '3 minutes', 92, -38, '1.1.8', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{"calibration_date": "2024-01-20", "accuracy": "±2%RH"}'),
('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-003', 'Pressure Sensor 1', 'pressure_sensor', 'PS-3000', 'PS001236', 'warning', NOW() - INTERVAL '15 minutes', 45, -55, '2.0.1', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '{"calibration_date": "2024-02-01", "range": "0-100 PSI"}'),
('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-004', 'Motion Detector 1', 'motion_sensor', 'MD-400', 'MD001237', 'offline', NOW() - INTERVAL '2 hours', 12, -78, '1.0.5', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '{"detection_range": "10m", "sensitivity": "high"}'),
('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-005', 'Temperature Sensor 2', 'temperature_sensor', 'TS-2000', 'TS001238', 'online', NOW() - INTERVAL '2 minutes', 95, -42, '1.2.3', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{"calibration_date": "2024-02-10", "accuracy": "±0.1°C"}'),
('40000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-006', 'Humidity Sensor 2', 'humidity_sensor', 'HS-1500', 'HS001239', 'online', NOW() - INTERVAL '1 minute', 88, -40, '1.1.8', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '{"calibration_date": "2024-02-15", "accuracy": "±2%RH"}'),
('40000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-007', 'Light Level Sensor', 'light_sensor', 'LS-800', 'LS001240', 'online', NOW() - INTERVAL '4 minutes', 78, -48, '1.0.2', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '{"sensitivity": "high", "range": "0-100000 lux"}'),
('40000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-008', 'Vibration Monitor', 'vibration_sensor', 'VM-600', 'VM001241', 'online', NOW() - INTERVAL '6 minutes', 82, -43, '2.1.0', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{"threshold": "0.5g", "sampling_rate": "1000Hz"}'),
('40000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-009', 'CO2 Monitor', 'air_quality_sensor', 'AQ-200', 'AQ001242', 'online', NOW() - INTERVAL '8 minutes', 91, -39, '1.5.0', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '{"range": "400-5000 ppm", "accuracy": "±50 ppm"}'),
('40000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-010', 'Door Sensor A1', 'door_sensor', 'DS-100', 'DS001243', 'online', NOW() - INTERVAL '1 minute', 97, -35, '1.0.0', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{"type": "magnetic", "status": "closed"}'),
('40000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-011', 'Water Level Sensor', 'level_sensor', 'WL-300', 'WL001244', 'warning', NOW() - INTERVAL '20 minutes', 35, -60, '1.2.0', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '{"range": "0-10m", "accuracy": "±1cm"}'),
('40000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-012', 'Energy Meter 1', 'power_meter', 'PM-500', 'PM001245', 'online', NOW() - INTERVAL '5 minutes', 100, -36, '2.0.0', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{"phase": "3-phase", "max_current": "100A"}'),
('40000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-013', 'Smoke Detector B2', 'smoke_detector', 'SD-700', 'SD001246', 'online', NOW() - INTERVAL '3 minutes', 89, -41, '1.3.2', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '{"type": "photoelectric", "test_date": "2024-03-01"}'),
('40000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-014', 'Motion Detector 2', 'motion_sensor', 'MD-400', 'MD001247', 'online', NOW() - INTERVAL '7 minutes', 76, -46, '1.0.5', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '{"detection_range": "10m", "sensitivity": "medium"}'),
('40000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-015', 'Flow Meter 1', 'flow_sensor', 'FM-400', 'FM001248', 'offline', NOW() - INTERVAL '45 minutes', 8, -85, '1.1.0', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '{"range": "0-100 L/min", "fluid_type": "water"}'),
('40000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', NULL, NULL, 'Gateway Device', 'gateway', 'GW-1000', 'GW001249', 'online', NOW() - INTERVAL '1 minute', NULL, -30, '3.0.1', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{"connected_devices": 15, "uptime": "99.8%"}'),
('40000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-016', 'Pressure Sensor 2', 'pressure_sensor', 'PS-3000', 'PS001250', 'online', NOW() - INTERVAL '4 minutes', 84, -44, '2.0.1', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '{"calibration_date": "2024-03-05", "range": "0-100 PSI"}'),
('40000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-017', 'Tank Level Monitor', 'level_sensor', 'TL-250', 'TL001251', 'warning', NOW() - INTERVAL '25 minutes', 28, -65, '1.0.8', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '{"capacity": "1000L", "current_level": "25%"}'),
('40000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-018', 'HVAC Controller', 'hvac_controller', 'HC-2000', 'HC001252', 'online', NOW() - INTERVAL '2 minutes', NULL, -37, '2.5.0', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{"mode": "auto", "target_temp": "22°C", "zones": 4}'),
('40000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sensor-019', 'Security Camera 1', 'camera', 'CAM-HD', 'CAM001253', 'online', NOW() - INTERVAL '30 seconds', NULL, -33, '4.2.1', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{"resolution": "1080p", "fps": 30, "night_vision": true}')
ON CONFLICT (id) DO NOTHING;


-- ====================== STEP 9: Device Data =================================
INSERT INTO device_data (device_id, sensor_type, value, unit, quality, timestamp) VALUES
('40000000-0000-0000-0000-000000000001', 'temperature', 23.5, '°C', 98, NOW() - INTERVAL '5 minutes'),
('40000000-0000-0000-0000-000000000001', 'temperature', 23.7, '°C', 97, NOW() - INTERVAL '10 minutes'),
('40000000-0000-0000-0000-000000000001', 'temperature', 23.3, '°C', 99, NOW() - INTERVAL '15 minutes'),
('40000000-0000-0000-0000-000000000005', 'temperature', 22.8, '°C', 99, NOW() - INTERVAL '2 minutes'),
('40000000-0000-0000-0000-000000000005', 'temperature', 22.6, '°C', 98, NOW() - INTERVAL '7 minutes'),
('40000000-0000-0000-0000-000000000002', 'humidity', 45.2, '%RH', 95, NOW() - INTERVAL '3 minutes'),
('40000000-0000-0000-0000-000000000002', 'humidity', 44.8, '%RH', 96, NOW() - INTERVAL '8 minutes'),
('40000000-0000-0000-0000-000000000002', 'humidity', 46.1, '%RH', 94, NOW() - INTERVAL '13 minutes'),
('40000000-0000-0000-0000-000000000006', 'humidity', 48.5, '%RH', 97, NOW() - INTERVAL '1 minute'),
('40000000-0000-0000-0000-000000000006', 'humidity', 48.2, '%RH', 96, NOW() - INTERVAL '6 minutes'),
('40000000-0000-0000-0000-000000000003', 'pressure', 14.7, 'PSI', 85, NOW() - INTERVAL '15 minutes'),
('40000000-0000-0000-0000-000000000003', 'pressure', 14.9, 'PSI', 87, NOW() - INTERVAL '20 minutes'),
('40000000-0000-0000-0000-000000000003', 'pressure', 14.5, 'PSI', 89, NOW() - INTERVAL '25 minutes'),
('40000000-0000-0000-0000-000000000017', 'pressure', 15.2, 'PSI', 98, NOW() - INTERVAL '4 minutes'),
('40000000-0000-0000-0000-000000000007', 'light', 850.5, 'lux', 92, NOW() - INTERVAL '4 minutes'),
('40000000-0000-0000-0000-000000000007', 'light', 845.2, 'lux', 93, NOW() - INTERVAL '9 minutes'),
('40000000-0000-0000-0000-000000000009', 'co2', 420.0, 'ppm', 96, NOW() - INTERVAL '8 minutes'),
('40000000-0000-0000-0000-000000000009', 'co2', 415.5, 'ppm', 97, NOW() - INTERVAL '13 minutes'),
('40000000-0000-0000-0000-000000000012', 'power', 3250.5, 'W', 99, NOW() - INTERVAL '5 minutes'),
('40000000-0000-0000-0000-000000000012', 'current', 15.2, 'A', 99, NOW() - INTERVAL '5 minutes'),
('40000000-0000-0000-0000-000000000012', 'voltage', 230.5, 'V', 100, NOW() - INTERVAL '5 minutes');


-- ====================== STEP 10: Alerts =====================================
-- Seed alerts (from seed.sql)
INSERT INTO alerts (id, organization_id, device_id, alert_type, severity, title, message, metadata) VALUES
('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'low_battery', 'high', 'Low Battery Warning', 'Pressure Sensor 1 battery level is critically low (45%)', '{"battery_level": 45, "threshold": 50}'),
('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'device_offline', 'critical', 'Device Offline', 'Motion Detector 1 has been offline for over 1 hour', '{"offline_duration": "2 hours", "last_seen": "2024-12-01T10:00:00Z"}'),
('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'temperature_high', 'medium', 'Temperature Alert', 'Temperature reading above normal range', '{"value": 26.5, "threshold": 25.0, "unit": "°C"}'),
('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000011', 'low_battery', 'critical', 'Critical Battery Level', 'Water Level Sensor battery at 35%', '{"battery_level": 35, "threshold": 40}'),
('50000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000015', 'device_offline', 'high', 'Device Offline', 'Flow Meter 1 has been offline for 45 minutes', '{"offline_duration": "45 minutes"}'),
('50000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000018', 'level_low', 'medium', 'Low Tank Level', 'Tank Level Monitor shows only 25% capacity remaining', '{"current_level": 25, "threshold": 30, "unit": "%"}'),
('50000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000011', 'signal_weak', 'low', 'Weak Signal', 'Water Level Sensor signal strength is -60 dBm', '{"signal_strength": -60, "threshold": -55}')
ON CONFLICT (id) DO NOTHING;

-- Demo alerts (from migration 20260217000004 - with explicit IDs for idempotency)
INSERT INTO alerts (id, organization_id, alert_type, severity, title, message, metadata, is_resolved, category, created_at, updated_at) VALUES
('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'low_battery', 'critical', 'Critical Battery Alert', 'Battery at 10%', '{}', false, 'system', NOW() - INTERVAL '10 hours', NOW() - INTERVAL '8 hours'),
('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'device_offline', 'critical', 'Device Offline', 'Device not responding', '{}', false, 'system', NOW() - INTERVAL '26 hours', NOW() - INTERVAL '8 hours'),
('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'temperature_high', 'high', 'High Temperature', 'Temp exceeded 30°C', '{}', true, 'system', NOW() - INTERVAL '36 hours', NOW() - INTERVAL '8 hours'),
('60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'signal_weak', 'high', 'Weak Signal', 'Signal strength below threshold', '{}', false, 'system', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '8 hours'),
('60000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'humidity_high', 'medium', 'High Humidity', 'Humidity at 85%', '{}', false, 'system', NOW() - INTERVAL '15 hours', NOW() - INTERVAL '8 hours'),
('60000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'firmware_update', 'medium', 'Firmware Update Available', 'New firmware version ready', '{}', false, 'system', NOW() - INTERVAL '20 hours', NOW() - INTERVAL '8 hours'),
('60000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'maintenance_due', 'low', 'Maintenance Due', 'Schedule maintenance soon', '{}', false, 'system', NOW() - INTERVAL '48 hours', NOW() - INTERVAL '8 hours'),
('60000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'data_sync', 'low', 'Data Sync Complete', 'All data synchronized', '{}', true, 'system', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '3 hours')
ON CONFLICT (id) DO NOTHING;


-- ====================== STEP 11: Audit Logs =================================
INSERT INTO audit_logs (organization_id, action, resource_type, resource_id, metadata) VALUES
('00000000-0000-0000-0000-000000000001', 'create', 'device', '40000000-0000-0000-0000-000000000001', '{"device_name": "Temperature Sensor 1"}'),
('00000000-0000-0000-0000-000000000001', 'create', 'device', '40000000-0000-0000-0000-000000000002', '{"device_name": "Humidity Sensor 1"}'),
('00000000-0000-0000-0000-000000000001', 'create', 'alert', '50000000-0000-0000-0000-000000000001', '{"alert_type": "low_battery", "severity": "high"}');


-- ====================== VERIFICATION ========================================
SELECT '--- DATA VERIFICATION ---' as status;
SELECT 'auth.users' as table_name, COUNT(*) as row_count FROM auth.users
UNION ALL SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'organization_members', COUNT(*) FROM organization_members
UNION ALL SELECT 'locations', COUNT(*) FROM locations
UNION ALL SELECT 'departments', COUNT(*) FROM departments
UNION ALL SELECT 'device_integrations', COUNT(*) FROM device_integrations
UNION ALL SELECT 'devices', COUNT(*) FROM devices
UNION ALL SELECT 'device_data', COUNT(*) FROM device_data
UNION ALL SELECT 'alerts', COUNT(*) FROM alerts
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
ORDER BY table_name;

-- ============================================================================
-- TEST CREDENTIALS (same across all environments):
-- ============================================================================
-- superadmin@netneural.ai / SuperSecure123!  (super_admin - platform-wide)
-- admin@netneural.ai     / password123       (org_owner - full org access)
-- user@netneural.ai      / password123       (user - standard access)
-- viewer@netneural.ai    / password123       (viewer - read-only)
-- ============================================================================
