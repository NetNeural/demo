-- IoT Sensor Management Platform Seed Data
-- Sample data for retail chain sensor monitoring

-- Sample Organization (like Kroger)
INSERT INTO public.organizations (id, name, slug, description, headquarters_address, owner_id) 
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'RetailChain Corp', 'retailchain-corp', 'Large retail chain with multiple subsidiaries', '123 Corporate Blvd, Atlanta, GA 30309', '550e8400-e29b-41d4-a716-446655440000')
ON CONFLICT (id) DO NOTHING;

-- Sample Subsidiaries (like Fred Meyer, Ralphs under Kroger)
INSERT INTO public.subsidiaries (id, organization_id, name, slug, description, headquarters_address)
VALUES 
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'SuperMart', 'supermart', 'Premium grocery chain', '456 Market St, Portland, OR 97201'),
  ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'ValueStore', 'valuestore', 'Budget-friendly retail stores', '789 Commerce Ave, Phoenix, AZ 85001')
ON CONFLICT (id) DO NOTHING;

-- Sample Locations (individual stores)
INSERT INTO public.locations (id, subsidiary_id, name, address, city, state_province, postal_code, latitude, longitude, store_number, phone_number, manager_email)
VALUES 
  ('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'SuperMart Downtown', '100 Main St', 'Portland', 'OR', '97201', 45.5152, -122.6784, 'SM001', '(503) 555-0001', 'manager.downtown@supermart.com'),
  ('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 'SuperMart Westside', '200 Oak Ave', 'Portland', 'OR', '97205', 45.5259, -122.7074, 'SM002', '(503) 555-0002', 'manager.westside@supermart.com'),
  ('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440002', 'ValueStore Central', '300 Pine St', 'Phoenix', 'AZ', '85001', 33.4484, -112.0740, 'VS001', '(602) 555-0001', 'manager.central@valuestore.com')
ON CONFLICT (id) DO NOTHING;

-- Sample Departments within stores
INSERT INTO public.departments (id, location_id, name, description, floor_level, area_square_feet)
VALUES 
  -- SuperMart Downtown departments
  ('880e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 'Pharmacy', 'Prescription and health services', 1, 500),
  ('880e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440001', 'Produce', 'Fresh fruits and vegetables', 1, 800),
  ('880e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440001', 'Dairy', 'Refrigerated dairy products', 1, 400),
  ('880e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440001', 'Electronics', 'Consumer electronics', 1, 600),
  -- SuperMart Westside departments
  ('880e8400-e29b-41d4-a716-446655440005', '770e8400-e29b-41d4-a716-446655440002', 'Pharmacy', 'Prescription and health services', 1, 450),
  ('880e8400-e29b-41d4-a716-446655440006', '770e8400-e29b-41d4-a716-446655440002', 'Produce', 'Fresh fruits and vegetables', 1, 750),
  -- ValueStore Central departments  
  ('880e8400-e29b-41d4-a716-446655440007', '770e8400-e29b-41d4-a716-446655440003', 'Produce', 'Fresh fruits and vegetables', 1, 600),
  ('880e8400-e29b-41d4-a716-446655440008', '770e8400-e29b-41d4-a716-446655440003', 'Frozen Foods', 'Frozen and refrigerated items', 1, 400)
ON CONFLICT (id) DO NOTHING;

-- Sample Gateways (IoT hubs for each location)
INSERT INTO public.gateways (id, location_id, name, mac_address, ip_address, firmware_version, status, last_seen, golioth_device_id)
VALUES 
  ('990e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 'Gateway-SM001-Main', '00:1B:44:11:3A:B7', '192.168.1.100', 'v2.1.3', 'online', NOW() - INTERVAL '2 minutes', 'gw_sm001_main'),
  ('990e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440002', 'Gateway-SM002-Main', '00:1B:44:11:3A:B8', '192.168.1.101', 'v2.1.3', 'online', NOW() - INTERVAL '1 minute', 'gw_sm002_main'),
  ('990e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440003', 'Gateway-VS001-Main', '00:1B:44:11:3A:B9', '192.168.1.102', 'v2.1.2', 'warning', NOW() - INTERVAL '15 minutes', 'gw_vs001_main')
ON CONFLICT (id) DO NOTHING;

-- Sample Sensors distributed across departments
INSERT INTO public.sensors (id, gateway_id, department_id, name, sensor_type, model, serial_number, golioth_device_id, status, battery_level, last_reading, last_seen, position_x, position_y, settings)
VALUES 
  -- SuperMart Downtown - Pharmacy sensors
  ('aa0e8400-e29b-41d4-a716-446655440001', '990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', 'Pharmacy-Temp-01', 'temperature', 'TempSense Pro', 'TS001001', 'sensor_pharmacy_temp_01', 'online', 85, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes', 10.5, 15.2, '{"reading_interval_seconds": 300, "alert_thresholds": {"min": 18, "max": 25}}'),
  ('aa0e8400-e29b-41d4-a716-446655440002', '990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', 'Pharmacy-Humidity-01', 'humidity', 'HumidityMax', 'HM001001', 'sensor_pharmacy_humid_01', 'online', 92, NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '3 minutes', 12.0, 16.8, '{"reading_interval_seconds": 300, "alert_thresholds": {"min": 40, "max": 60}}'),
  ('aa0e8400-e29b-41d4-a716-446655440003', '990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', 'Pharmacy-Door-01', 'door', 'SecureDoor', 'SD001001', 'sensor_pharmacy_door_01', 'online', 78, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute', 8.0, 20.0, '{"reading_interval_seconds": 60, "alert_thresholds": {}}'),
  
  -- SuperMart Downtown - Produce sensors
  ('aa0e8400-e29b-41d4-a716-446655440004', '990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440002', 'Produce-Temp-01', 'temperature', 'TempSense Pro', 'TS001002', 'sensor_produce_temp_01', 'online', 88, NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '4 minutes', 25.0, 10.5, '{"reading_interval_seconds": 300, "alert_thresholds": {"min": 2, "max": 8}}'),
  ('aa0e8400-e29b-41d4-a716-446655440005', '990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440002', 'Produce-Humidity-01', 'humidity', 'HumidityMax', 'HM001002', 'sensor_produce_humid_01', 'warning', 65, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes', 27.3, 12.1, '{"reading_interval_seconds": 300, "alert_thresholds": {"min": 85, "max": 95}}'),
  
  -- SuperMart Downtown - Dairy sensors
  ('aa0e8400-e29b-41d4-a716-446655440006', '990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440003', 'Dairy-Temp-01', 'temperature', 'ColdChain Monitor', 'CC001001', 'sensor_dairy_temp_01', 'online', 91, NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 minutes', 35.0, 8.0, '{"reading_interval_seconds": 180, "alert_thresholds": {"min": 1, "max": 4}}'),
  ('aa0e8400-e29b-41d4-a716-446655440007', '990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440003', 'Dairy-Door-01', 'door', 'SecureDoor', 'SD001002', 'sensor_dairy_door_01', 'online', 82, NOW() - INTERVAL '30 seconds', NOW() - INTERVAL '30 seconds', 40.0, 15.0, '{"reading_interval_seconds": 60, "alert_thresholds": {}}'),
  
  -- SuperMart Westside sensors
  ('aa0e8400-e29b-41d4-a716-446655440008', '990e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440005', 'Pharmacy-Temp-01', 'temperature', 'TempSense Pro', 'TS002001', 'sensor_sm2_pharmacy_temp_01', 'online', 89, NOW() - INTERVAL '6 minutes', NOW() - INTERVAL '6 minutes', 12.0, 18.0, '{"reading_interval_seconds": 300, "alert_thresholds": {"min": 18, "max": 25}}'),
  
  -- ValueStore Central sensors
  ('aa0e8400-e29b-41d4-a716-446655440009', '990e8400-e29b-41d4-a716-446655440003', '880e8400-e29b-41d4-a716-446655440007', 'Produce-Temp-01', 'temperature', 'BasicTemp', 'BT003001', 'sensor_vs1_produce_temp_01', 'error', 15, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', 20.0, 12.0, '{"reading_interval_seconds": 600, "alert_thresholds": {"min": 2, "max": 8}}')
ON CONFLICT (id) DO NOTHING;

-- Sample recent sensor readings
INSERT INTO public.sensor_readings (sensor_id, reading_time, value, unit, quality_score)
VALUES 
  -- Pharmacy temperature readings (should be 18-25°C)
  ('aa0e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '5 minutes', 22.3, 'celsius', 100),
  ('aa0e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '10 minutes', 22.1, 'celsius', 100),
  ('aa0e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '15 minutes', 21.9, 'celsius', 100),
  
  -- Pharmacy humidity readings (should be 40-60%)
  ('aa0e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '3 minutes', 52.1, 'percent', 100),
  ('aa0e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '8 minutes', 51.8, 'percent', 100),
  
  -- Produce temperature readings (should be 2-8°C) - this one will trigger an alert
  ('aa0e8400-e29b-41d4-a716-446655440004', NOW() - INTERVAL '4 minutes', 6.5, 'celsius', 100),
  ('aa0e8400-e29b-41d4-a716-446655440004', NOW() - INTERVAL '9 minutes', 6.8, 'celsius', 100),
  ('aa0e8400-e29b-41d4-a716-446655440004', NOW() - INTERVAL '14 minutes', 9.2, 'celsius', 95), -- Alert: above threshold
  
  -- Dairy temperature readings (should be 1-4°C)
  ('aa0e8400-e29b-41d4-a716-446655440006', NOW() - INTERVAL '2 minutes', 2.8, 'celsius', 100),
  ('aa0e8400-e29b-41d4-a716-446655440006', NOW() - INTERVAL '7 minutes', 2.9, 'celsius', 100),
  
  -- Door sensor readings (0 = closed, 1 = open)
  ('aa0e8400-e29b-41d4-a716-446655440003', NOW() - INTERVAL '1 minute', 0, 'boolean', 100),
  ('aa0e8400-e29b-41d4-a716-446655440003', NOW() - INTERVAL '5 minutes', 1, 'boolean', 100),
  ('aa0e8400-e29b-41d4-a716-446655440003', NOW() - INTERVAL '6 minutes', 0, 'boolean', 100)
ON CONFLICT DO NOTHING;

-- Sample alert rules
INSERT INTO public.alert_rules (id, sensor_id, name, description, alert_level, condition_type, threshold_min, threshold_max, duration_minutes, created_by)
VALUES 
  ('bb0e8400-e29b-41d4-a716-446655440001', 'aa0e8400-e29b-41d4-a716-446655440001', 'Pharmacy Temperature Range', 'Pharmacy must maintain 18-25°C for medication safety', 'yellow', 'range', 18.0, 25.0, 5, '550e8400-e29b-41d4-a716-446655440000'),
  ('bb0e8400-e29b-41d4-a716-446655440002', 'aa0e8400-e29b-41d4-a716-446655440004', 'Produce Temperature Range', 'Produce must stay between 2-8°C for freshness', 'red', 'range', 2.0, 8.0, 3, '550e8400-e29b-41d4-a716-446655440000'),
  ('bb0e8400-e29b-41d4-a716-446655440003', 'aa0e8400-e29b-41d4-a716-446655440006', 'Dairy Temperature Critical', 'Dairy must stay between 1-4°C for safety', 'critical', 'range', 1.0, 4.0, 2, '550e8400-e29b-41d4-a716-446655440000'),
  ('bb0e8400-e29b-41d4-a716-446655440004', 'aa0e8400-e29b-41d4-a716-446655440002', 'Pharmacy Humidity Range', 'Pharmacy humidity should be 40-60%', 'yellow', 'range', 40.0, 60.0, 10, '550e8400-e29b-41d4-a716-446655440000')
ON CONFLICT (id) DO NOTHING;

-- Sample active alert (produce temperature out of range)
INSERT INTO public.alerts (id, alert_rule_id, sensor_id, alert_level, title, message, triggered_at, trigger_value, is_active)
VALUES 
  ('cc0e8400-e29b-41d4-a716-446655440001', 'bb0e8400-e29b-41d4-a716-446655440002', 'aa0e8400-e29b-41d4-a716-446655440004', 'red', 'Produce Temperature Alert', 'Produce temperature reading of 9.2°C exceeds safe range (2-8°C) at SuperMart Downtown', NOW() - INTERVAL '14 minutes', 9.2, true)
ON CONFLICT (id) DO NOTHING;

-- Sample notification recipients
INSERT INTO public.notification_recipients (alert_rule_id, email, notification_method)
VALUES 
  ('bb0e8400-e29b-41d4-a716-446655440001', 'manager.downtown@supermart.com', 'email'),
  ('bb0e8400-e29b-41d4-a716-446655440002', 'manager.downtown@supermart.com', 'email'),
  ('bb0e8400-e29b-41d4-a716-446655440003', 'manager.downtown@supermart.com', 'email'),
  ('bb0e8400-e29b-41d4-a716-446655440002', 'alerts@retailchain.com', 'email'),
  ('bb0e8400-e29b-41d4-a716-446655440003', 'critical@retailchain.com', 'email')
ON CONFLICT DO NOTHING;

-- Sample user permissions (grant access to different organizational levels)
INSERT INTO public.user_permissions (user_id, organization_id, role, granted_by)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'admin', '550e8400-e29b-41d4-a716-446655440000')
ON CONFLICT DO NOTHING;
