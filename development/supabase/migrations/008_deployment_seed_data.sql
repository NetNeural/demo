-- Sample data for IoT Dashboard deployment
-- This provides realistic test data for the dashboard

-- Sample locations
INSERT INTO public.locations (id, name, address, city, state_province, latitude, longitude, sensors_total, sensors_online, alerts_active) 
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'Building A - Main Campus', '123 Corporate Blvd', 'Atlanta', 'GA', 33.7490, -84.3880, 8, 7, 1),
  ('550e8400-e29b-41d4-a716-446655440002', 'Building B - Research Lab', '456 Innovation Dr', 'Portland', 'OR', 45.5152, -122.6784, 6, 5, 0),
  ('550e8400-e29b-41d4-a716-446655440003', 'Warehouse C - Distribution', '789 Commerce Ave', 'Phoenix', 'AZ', 33.4484, -112.0740, 10, 8, 2)
ON CONFLICT (id) DO NOTHING;

-- Sample sensors
INSERT INTO public.sensors (id, name, type, location, department, status, current_value, unit, battery_level, last_reading, last_seen) 
VALUES 
  -- Building A sensors
  ('660e8400-e29b-41d4-a716-446655440001', 'Lobby Temperature Sensor', 'temperature', 'Building A - Main Campus', 'Facilities', 'online', 22.5, '°C', 85, NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 minutes'),
  ('660e8400-e29b-41d4-a716-446655440002', 'Conference Room Motion Detector', 'motion', 'Building A - Main Campus', 'IT', 'online', 0, 'boolean', 92, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute'),
  ('660e8400-e29b-41d4-a716-446655440003', 'Server Room Humidity Monitor', 'humidity', 'Building A - Main Campus', 'IT', 'online', 45.2, '%RH', 78, NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '3 minutes'),
  ('660e8400-e29b-41d4-a716-446655440004', 'Office Air Quality Sensor', 'air_quality', 'Building A - Main Campus', 'HR', 'warning', 85, 'AQI', 67, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'),
  ('660e8400-e29b-41d4-a716-446655440005', 'Basement Pressure Monitor', 'pressure', 'Building A - Main Campus', 'Facilities', 'online', 1013.25, 'hPa', 91, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute'),
  ('660e8400-e29b-41d4-a716-446655440006', 'Reception Temperature Control', 'temperature', 'Building A - Main Campus', 'Reception', 'online', 23.1, '°C', 88, NOW() - INTERVAL '30 seconds', NOW() - INTERVAL '30 seconds'),
  ('660e8400-e29b-41d4-a716-446655440007', 'Break Room Motion Sensor', 'motion', 'Building A - Main Campus', 'HR', 'online', 1, 'boolean', 95, NOW() - INTERVAL '10 seconds', NOW() - INTERVAL '10 seconds'),
  ('660e8400-e29b-41d4-a716-446655440008', 'Storage Room Humidity', 'humidity', 'Building A - Main Campus', 'Facilities', 'offline', 0, '%RH', 12, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
  
  -- Building B sensors
  ('660e8400-e29b-41d4-a716-446655440009', 'Lab Temperature Monitor', 'temperature', 'Building B - Research Lab', 'Research', 'online', 20.8, '°C', 76, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute'),
  ('660e8400-e29b-41d4-a716-446655440010', 'Clean Room Pressure', 'pressure', 'Building B - Research Lab', 'Research', 'online', 1015.2, 'hPa', 89, NOW() - INTERVAL '30 seconds', NOW() - INTERVAL '30 seconds'),
  ('660e8400-e29b-41d4-a716-446655440011', 'Equipment Room Humidity', 'humidity', 'Building B - Research Lab', 'Research', 'online', 40.1, '%RH', 82, NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 minutes'),
  ('660e8400-e29b-41d4-a716-446655440012', 'Security Motion Detector', 'motion', 'Building B - Research Lab', 'Security', 'online', 0, 'boolean', 94, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'),
  ('660e8400-e29b-41d4-a716-446655440013', 'Air Quality Monitor', 'air_quality', 'Building B - Research Lab', 'Research', 'online', 35, 'AQI', 71, NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '3 minutes'),
  ('660e8400-e29b-41d4-a716-446655440014', 'Entrance Temperature', 'temperature', 'Building B - Research Lab', 'Security', 'offline', 0, '°C', 5, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),
  
  -- Warehouse C sensors  
  ('660e8400-e29b-41d4-a716-446655440015', 'Loading Dock Temperature', 'temperature', 'Warehouse C - Distribution', 'Logistics', 'online', 28.3, '°C', 73, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute'),
  ('660e8400-e29b-41d4-a716-446655440016', 'Cold Storage Temp Monitor', 'temperature', 'Warehouse C - Distribution', 'Cold Storage', 'online', 2.1, '°C', 80, NOW() - INTERVAL '30 seconds', NOW() - INTERVAL '30 seconds'),
  ('660e8400-e29b-41d4-a716-446655440017', 'Freezer Temperature Alert', 'temperature', 'Warehouse C - Distribution', 'Cold Storage', 'error', -15.2, '°C', 65, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes'),
  ('660e8400-e29b-41d4-a716-446655440018', 'Dock Motion Sensor', 'motion', 'Warehouse C - Distribution', 'Logistics', 'online', 1, 'boolean', 87, NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 minutes'),
  ('660e8400-e29b-41d4-a716-446655440019', 'Storage Humidity Monitor', 'humidity', 'Warehouse C - Distribution', 'Storage', 'online', 55.8, '%RH', 79, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute'),
  ('660e8400-e29b-41d4-a716-446655440020', 'Air Quality - Dock Area', 'air_quality', 'Warehouse C - Distribution', 'Logistics', 'warning', 95, 'AQI', 84, NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '3 minutes'),
  ('660e8400-e29b-41d4-a716-446655440021', 'Office Pressure Monitor', 'pressure', 'Warehouse C - Distribution', 'Administration', 'online', 1012.8, 'hPa', 92, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute'),
  ('660e8400-e29b-41d4-a716-446655440022', 'Security Motion - Perimeter', 'motion', 'Warehouse C - Distribution', 'Security', 'online', 0, 'boolean', 96, NOW() - INTERVAL '30 seconds', NOW() - INTERVAL '30 seconds'),
  ('660e8400-e29b-41d4-a716-446655440023', 'Break Room Temperature', 'temperature', 'Warehouse C - Distribution', 'HR', 'offline', 0, '°C', 8, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),
  ('660e8400-e29b-41d4-a716-446655440024', 'Shipping Humidity Control', 'humidity', 'Warehouse C - Distribution', 'Logistics', 'online', 48.3, '%RH', 81, NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 minutes')
ON CONFLICT (id) DO NOTHING;

-- Sample alerts
INSERT INTO public.alerts (id, sensor_id, level, title, message, is_active, triggered_at) 
VALUES 
  ('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440004', 'warning', 'Air Quality Warning', 'Air quality index above normal threshold (85 AQI)', true, NOW() - INTERVAL '25 minutes'),
  ('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440008', 'error', 'Sensor Offline', 'Humidity sensor has been offline for over 1 hour', true, NOW() - INTERVAL '2 hours'),
  ('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440017', 'critical', 'Critical Temperature Alert', 'Freezer temperature outside safe range (-15.2°C)', true, NOW() - INTERVAL '10 minutes'),
  ('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440020', 'warning', 'Air Quality Degraded', 'Dock area air quality approaching unhealthy levels', true, NOW() - INTERVAL '15 minutes'),
  ('770e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440014', 'error', 'Temperature Sensor Offline', 'Building B entrance sensor unresponsive', true, NOW() - INTERVAL '4 hours'),
  ('770e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440023', 'error', 'Break Room Sensor Down', 'Temperature sensor offline for extended period', true, NOW() - INTERVAL '6 hours')
ON CONFLICT (id) DO NOTHING;

-- Generate some recent sensor readings for charts
INSERT INTO public.sensor_readings (sensor_id, value, unit, reading_time)
SELECT 
  s.id,
  CASE s.type
    WHEN 'temperature' THEN s.current_value + (RANDOM() - 0.5) * 2
    WHEN 'humidity' THEN s.current_value + (RANDOM() - 0.5) * 5
    WHEN 'pressure' THEN s.current_value + (RANDOM() - 0.5) * 3
    WHEN 'air_quality' THEN s.current_value + (RANDOM() - 0.5) * 10
    WHEN 'motion' THEN ROUND(RANDOM())
  END,
  s.unit,
  NOW() - (INTERVAL '1 hour' * generate_series(1, 24))
FROM public.sensors s
WHERE s.status = 'online'
ON CONFLICT DO NOTHING;
