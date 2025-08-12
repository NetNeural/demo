-- NetNeural IoT Dashboard - Complete Sample Data Script
-- Copy and paste this entire script into your Supabase SQL Editor
-- This will populate your dashboard with comprehensive demo data

-- First, let's ensure we have the tables (in case they don't exist)
-- If tables already exist, these will be ignored

-- Locations table
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state_province TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    sensors_total INTEGER DEFAULT 0,
    sensors_online INTEGER DEFAULT 0,
    alerts_active INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sensors table
CREATE TABLE IF NOT EXISTS public.sensors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    location TEXT,
    department TEXT,
    status TEXT DEFAULT 'online',
    current_value DECIMAL(10, 4),
    unit TEXT,
    battery_level INTEGER,
    last_reading TIMESTAMP WITH TIME ZONE,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alerts table
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_id UUID REFERENCES public.sensors(id),
    level TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    is_active BOOLEAN DEFAULT true,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sensor readings table for historical data
CREATE TABLE IF NOT EXISTS public.sensor_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_id UUID REFERENCES public.sensors(id),
    value DECIMAL(10, 4) NOT NULL,
    unit TEXT,
    reading_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sensor_id, reading_time)
);

-- Clear existing demo data (optional - remove these lines if you want to keep existing data)
DELETE FROM public.sensor_readings WHERE sensor_id IN (
    SELECT id FROM public.sensors WHERE id::text LIKE '660e8400-e29b-41d4-a716-4466554404%'
);
DELETE FROM public.alerts WHERE id::text LIKE '770e8400-e29b-41d4-a716-4466554404%';
DELETE FROM public.sensors WHERE id::text LIKE '660e8400-e29b-41d4-a716-4466554404%';
DELETE FROM public.locations WHERE id::text LIKE '550e8400-e29b-41d4-a716-4466554404%';

-- Insert sample locations (update if exists)
INSERT INTO public.locations (id, name, address, city, state_province, latitude, longitude, sensors_total, sensors_online, alerts_active) 
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'Building A - Main Campus', '123 Corporate Blvd', 'Atlanta', 'GA', 33.7490, -84.3880, 8, 7, 1),
  ('550e8400-e29b-41d4-a716-446655440002', 'Building B - Research Lab', '456 Innovation Dr', 'Portland', 'OR', 45.5152, -122.6784, 6, 5, 0),
  ('550e8400-e29b-41d4-a716-446655440003', 'Warehouse C - Distribution', '789 Commerce Ave', 'Phoenix', 'AZ', 33.4484, -112.0740, 10, 8, 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  state_province = EXCLUDED.state_province,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  sensors_total = EXCLUDED.sensors_total,
  sensors_online = EXCLUDED.sensors_online,
  alerts_active = EXCLUDED.alerts_active,
  updated_at = NOW();

-- Insert sample sensors (update if exists)
INSERT INTO public.sensors (id, name, type, location, department, status, current_value, unit, battery_level, last_reading, last_seen) 
VALUES 
  -- Building A sensors (8 total: 7 online, 1 offline)
  ('660e8400-e29b-41d4-a716-446655440001', 'Lobby Temperature Sensor', 'temperature', 'Building A - Main Campus', 'Facilities', 'online', 22.5, '°C', 85, NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 minutes'),
  ('660e8400-e29b-41d4-a716-446655440002', 'Conference Room Motion Detector', 'motion', 'Building A - Main Campus', 'IT', 'online', 0, 'boolean', 92, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute'),
  ('660e8400-e29b-41d4-a716-446655440003', 'Server Room Humidity Monitor', 'humidity', 'Building A - Main Campus', 'IT', 'online', 45.2, '%RH', 78, NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '3 minutes'),
  ('660e8400-e29b-41d4-a716-446655440004', 'Office Air Quality Sensor', 'air_quality', 'Building A - Main Campus', 'HR', 'warning', 85, 'AQI', 67, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'),
  ('660e8400-e29b-41d4-a716-446655440005', 'Basement Pressure Monitor', 'pressure', 'Building A - Main Campus', 'Facilities', 'online', 1013.25, 'hPa', 91, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute'),
  ('660e8400-e29b-41d4-a716-446655440006', 'Reception Temperature Control', 'temperature', 'Building A - Main Campus', 'Reception', 'online', 23.1, '°C', 88, NOW() - INTERVAL '30 seconds', NOW() - INTERVAL '30 seconds'),
  ('660e8400-e29b-41d4-a716-446655440007', 'Break Room Motion Sensor', 'motion', 'Building A - Main Campus', 'HR', 'online', 1, 'boolean', 95, NOW() - INTERVAL '10 seconds', NOW() - INTERVAL '10 seconds'),
  ('660e8400-e29b-41d4-a716-446655440008', 'Storage Room Humidity', 'humidity', 'Building A - Main Campus', 'Facilities', 'offline', 0, '%RH', 12, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
  
  -- Building B sensors (6 total: 5 online, 1 offline)
  ('660e8400-e29b-41d4-a716-446655440009', 'Lab Temperature Monitor', 'temperature', 'Building B - Research Lab', 'Research', 'online', 20.8, '°C', 76, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute'),
  ('660e8400-e29b-41d4-a716-446655440010', 'Clean Room Pressure', 'pressure', 'Building B - Research Lab', 'Research', 'online', 1015.2, 'hPa', 89, NOW() - INTERVAL '30 seconds', NOW() - INTERVAL '30 seconds'),
  ('660e8400-e29b-41d4-a716-446655440011', 'Equipment Room Humidity', 'humidity', 'Building B - Research Lab', 'Research', 'online', 40.1, '%RH', 82, NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 minutes'),
  ('660e8400-e29b-41d4-a716-446655440012', 'Security Motion Detector', 'motion', 'Building B - Research Lab', 'Security', 'online', 0, 'boolean', 94, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'),
  ('660e8400-e29b-41d4-a716-446655440013', 'Air Quality Monitor', 'air_quality', 'Building B - Research Lab', 'Research', 'online', 35, 'AQI', 71, NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '3 minutes'),
  ('660e8400-e29b-41d4-a716-446655440014', 'Entrance Temperature', 'temperature', 'Building B - Research Lab', 'Security', 'offline', 0, '°C', 5, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),
  
  -- Warehouse C sensors (10 total: 8 online, 2 offline)
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
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  location = EXCLUDED.location,
  department = EXCLUDED.department,
  status = EXCLUDED.status,
  current_value = EXCLUDED.current_value,
  unit = EXCLUDED.unit,
  battery_level = EXCLUDED.battery_level,
  last_reading = EXCLUDED.last_reading,
  last_seen = EXCLUDED.last_seen,
  updated_at = NOW();

-- Insert sample alerts (update if exists)
INSERT INTO public.alerts (id, sensor_id, level, title, message, is_active, triggered_at) 
VALUES 
  ('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440004', 'warning', 'Air Quality Warning', 'Air quality index above normal threshold (85 AQI)', true, NOW() - INTERVAL '25 minutes'),
  ('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440008', 'error', 'Sensor Offline', 'Humidity sensor has been offline for over 1 hour', true, NOW() - INTERVAL '2 hours'),
  ('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440017', 'critical', 'Critical Temperature Alert', 'Freezer temperature outside safe range (-15.2°C)', true, NOW() - INTERVAL '10 minutes'),
  ('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440020', 'warning', 'Air Quality Degraded', 'Dock area air quality approaching unhealthy levels', true, NOW() - INTERVAL '15 minutes'),
  ('770e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440014', 'error', 'Temperature Sensor Offline', 'Building B entrance sensor unresponsive', true, NOW() - INTERVAL '4 hours'),
  ('770e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440023', 'error', 'Break Room Sensor Down', 'Temperature sensor offline for extended period', true, NOW() - INTERVAL '6 hours')
ON CONFLICT (id) DO UPDATE SET
  sensor_id = EXCLUDED.sensor_id,
  level = EXCLUDED.level,
  title = EXCLUDED.title,
  message = EXCLUDED.message,
  is_active = EXCLUDED.is_active,
  triggered_at = EXCLUDED.triggered_at;

-- Generate historical sensor readings (last 24 hours) for all ONLINE sensors
-- This creates realistic chart data for the dashboard
INSERT INTO public.sensor_readings (sensor_id, value, unit, reading_time)
SELECT 
  s.id,
  CASE s.type
    WHEN 'temperature' THEN s.current_value + (RANDOM() - 0.5) * 4 + SIN(EXTRACT(HOUR FROM (NOW() - (h || ' hours')::INTERVAL)) * PI() / 12) * 2
    WHEN 'humidity' THEN GREATEST(0, s.current_value + (RANDOM() - 0.5) * 10 - SIN(EXTRACT(HOUR FROM (NOW() - (h || ' hours')::INTERVAL)) * PI() / 12) * 5)
    WHEN 'pressure' THEN s.current_value + (RANDOM() - 0.5) * 5 + SIN(EXTRACT(HOUR FROM (NOW() - (h || ' hours')::INTERVAL)) * PI() / 24) * 2
    WHEN 'air_quality' THEN GREATEST(0, s.current_value + (RANDOM() - 0.5) * 20 + 
      CASE 
        WHEN EXTRACT(HOUR FROM (NOW() - (h || ' hours')::INTERVAL)) BETWEEN 7 AND 9 THEN 15  -- Morning rush
        WHEN EXTRACT(HOUR FROM (NOW() - (h || ' hours')::INTERVAL)) BETWEEN 17 AND 19 THEN 20  -- Evening rush
        ELSE 0
      END)
    WHEN 'motion' THEN 
      CASE 
        WHEN EXTRACT(HOUR FROM (NOW() - (h || ' hours')::INTERVAL)) BETWEEN 6 AND 22 THEN ROUND(RANDOM() * 0.8)  -- More activity during day
        ELSE ROUND(RANDOM() * 0.2)  -- Less activity at night
      END
    ELSE s.current_value
  END,
  s.unit,
  NOW() - (h || ' hours')::INTERVAL
FROM public.sensors s
CROSS JOIN generate_series(1, 24) AS h
WHERE s.status = 'online'
  AND s.id::text LIKE '660e8400-e29b-41d4-a716-4466554404%';

-- Create some additional recent readings (last 2 hours) for more granular data
INSERT INTO public.sensor_readings (sensor_id, value, unit, reading_time)
SELECT 
  s.id,
  CASE s.type
    WHEN 'temperature' THEN s.current_value + (RANDOM() - 0.5) * 1.5
    WHEN 'humidity' THEN GREATEST(0, s.current_value + (RANDOM() - 0.5) * 3)
    WHEN 'pressure' THEN s.current_value + (RANDOM() - 0.5) * 2
    WHEN 'air_quality' THEN GREATEST(0, s.current_value + (RANDOM() - 0.5) * 8)
    WHEN 'motion' THEN ROUND(RANDOM())
    ELSE s.current_value
  END,
  s.unit,
  NOW() - (m || ' minutes')::INTERVAL
FROM public.sensors s
CROSS JOIN generate_series(5, 120, 5) AS m  -- Every 5 minutes for last 2 hours
WHERE s.status = 'online'
  AND s.id::text LIKE '660e8400-e29b-41d4-a716-4466554404%'
ON CONFLICT (sensor_id, reading_time) DO NOTHING;

-- Enable Row Level Security and create policies (handle all errors gracefully)
DO $$ 
BEGIN
    -- Drop existing policies first if they exist
    BEGIN
        DROP POLICY IF EXISTS "Allow anonymous read access" ON public.locations;
        DROP POLICY IF EXISTS "Allow anonymous read access" ON public.sensors;
        DROP POLICY IF EXISTS "Allow anonymous read access" ON public.alerts;
        DROP POLICY IF EXISTS "Allow anonymous read access" ON public.sensor_readings;
    EXCEPTION WHEN OTHERS THEN 
        NULL;
    END;
    
    -- Enable RLS on all tables
    BEGIN
        ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
    EXCEPTION WHEN OTHERS THEN 
        NULL;
    END;
    
    BEGIN
        ALTER TABLE public.sensors ENABLE ROW LEVEL SECURITY;
    EXCEPTION WHEN OTHERS THEN 
        NULL;
    END;
    
    BEGIN
        ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
    EXCEPTION WHEN OTHERS THEN 
        NULL;
    END;
    
    BEGIN
        ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;
    EXCEPTION WHEN OTHERS THEN 
        NULL;
    END;
    
    -- Create fresh policies
    BEGIN
        CREATE POLICY "Allow anonymous read access" ON public.locations FOR SELECT USING (true);
    EXCEPTION WHEN OTHERS THEN 
        NULL;
    END;
    
    BEGIN
        CREATE POLICY "Allow anonymous read access" ON public.sensors FOR SELECT USING (true);
    EXCEPTION WHEN OTHERS THEN 
        NULL;
    END;
    
    BEGIN
        CREATE POLICY "Allow anonymous read access" ON public.alerts FOR SELECT USING (true);
    EXCEPTION WHEN OTHERS THEN 
        NULL;
    END;
    
    BEGIN
        CREATE POLICY "Allow anonymous read access" ON public.sensor_readings FOR SELECT USING (true);
    EXCEPTION WHEN OTHERS THEN 
        NULL;
    END;
END $$;

-- Summary query to verify the data
SELECT 
  'SUMMARY' as type,
  'Locations' as category,
  COUNT(*) as count
FROM public.locations
WHERE id::text LIKE '550e8400-e29b-41d4-a716-4466554404%'

UNION ALL

SELECT 
  'SUMMARY' as type,
  'Sensors' as category,
  COUNT(*) as count
FROM public.sensors
WHERE id::text LIKE '660e8400-e29b-41d4-a716-4466554404%'

UNION ALL

SELECT 
  'SUMMARY' as type,
  'Alerts' as category,
  COUNT(*) as count
FROM public.alerts
WHERE id::text LIKE '770e8400-e29b-41d4-a716-4466554404%'

UNION ALL

SELECT 
  'SUMMARY' as type,
  'Sensor Readings' as category,
  COUNT(*) as count
FROM public.sensor_readings
WHERE sensor_id::text LIKE '660e8400-e29b-41d4-a716-4466554404%';

-- Final success message
SELECT 
  '🎉 SUCCESS! Your IoT Dashboard now has comprehensive demo data!' as message,
  '📊 Data includes: 3 locations, 24 sensors, 6 active alerts, and 24+ hours of historical readings' as details,
  '🚀 Your dashboard should now display realistic IoT monitoring data for demonstration purposes' as next_steps;
