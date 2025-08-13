-- CAUTION: This will delete all existing sensor data!
-- Only run this if you want to start fresh

-- Drop existing sensors table and recreate with correct structure
DROP TABLE IF EXISTS public.sensor_readings CASCADE;
DROP TABLE IF EXISTS public.sensors CASCADE;

-- Recreate sensors table with all required columns
CREATE TABLE public.sensors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  location TEXT,
  device_id TEXT,
  status TEXT DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Recreate sensor_readings table
CREATE TABLE public.sensor_readings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  sensor_id UUID REFERENCES public.sensors(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Insert sample data
INSERT INTO public.sensors (name, type, location, device_id, status) VALUES
  ('Temperature Sensor 1', 'temperature', 'Living Room', 'device_001', 'active'),
  ('Humidity Sensor 1', 'humidity', 'Living Room', 'device_001', 'active'),
  ('Motion Sensor 1', 'motion', 'Front Door', 'device_002', 'active'),
  ('Light Sensor 1', 'light', 'Kitchen', 'device_003', 'active');

-- Enable RLS
ALTER TABLE public.sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access on sensors" ON public.sensors FOR SELECT USING (true);
CREATE POLICY "Allow public read access on sensor_readings" ON public.sensor_readings FOR SELECT USING (true);

-- Verify
SELECT 'Sensors created:' as status, COUNT(*) as count FROM public.sensors;
