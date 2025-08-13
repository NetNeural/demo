-- Supabase Database Setup for IoT Dashboard
-- Run this SQL in your Supabase SQL Editor

-- 1. Create sensors table
CREATE TABLE IF NOT EXISTS public.sensors (
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

-- 2. Create sensor_readings table
CREATE TABLE IF NOT EXISTS public.sensor_readings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  sensor_id UUID REFERENCES public.sensors(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Create devices table
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  name TEXT NOT NULL,
  device_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'online',
  last_seen TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. Create profiles table (for user management)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  website TEXT,
  
  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- 5. First, let's check and add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add device_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sensors' AND column_name='device_id') THEN
        ALTER TABLE public.sensors ADD COLUMN device_id TEXT;
    END IF;
    
    -- Add status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sensors' AND column_name='status') THEN
        ALTER TABLE public.sensors ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- 6. Insert sample data for testing
INSERT INTO public.sensors (name, type, location, device_id, status) VALUES
  ('Temperature Sensor 1', 'temperature', 'Living Room', 'device_001', 'active'),
  ('Humidity Sensor 1', 'humidity', 'Living Room', 'device_001', 'active'),
  ('Motion Sensor 1', 'motion', 'Front Door', 'device_002', 'active'),
  ('Light Sensor 1', 'light', 'Kitchen', 'device_003', 'active')
ON CONFLICT DO NOTHING;

-- 7. Insert sample sensor readings
DO $$
DECLARE
    sensor_record RECORD;
    i INTEGER;
BEGIN
    FOR sensor_record IN SELECT id, type FROM public.sensors LOOP
        FOR i IN 1..10 LOOP
            INSERT INTO public.sensor_readings (sensor_id, value, unit, timestamp) VALUES (
                sensor_record.id,
                CASE 
                    WHEN sensor_record.type = 'temperature' THEN random() * 30 + 15
                    WHEN sensor_record.type = 'humidity' THEN random() * 60 + 30
                    WHEN sensor_record.type = 'motion' THEN CASE WHEN random() > 0.7 THEN 1 ELSE 0 END
                    WHEN sensor_record.type = 'light' THEN random() * 1000
                    ELSE random() * 100
                END,
                CASE 
                    WHEN sensor_record.type = 'temperature' THEN '°C'
                    WHEN sensor_record.type = 'humidity' THEN '%'
                    WHEN sensor_record.type = 'motion' THEN 'boolean'
                    WHEN sensor_record.type = 'light' THEN 'lux'
                    ELSE 'unit'
                END,
                now() - (random() * INTERVAL '7 days')
            );
        END LOOP;
    END LOOP;
END $$;

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_id ON public.sensor_readings(sensor_id);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_timestamp ON public.sensor_readings(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sensors_device_id ON public.sensors(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON public.devices(device_id);

-- 8. Set up Row Level Security (RLS)
ALTER TABLE public.sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 9. Create policies for public access (adjust as needed for your security requirements)
CREATE POLICY "Allow public read access on sensors" ON public.sensors
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access on sensor_readings" ON public.sensor_readings
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access on devices" ON public.devices
    FOR SELECT USING (true);

-- For profiles, only allow users to see their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 10. Create a function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Create trigger to automatically create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 12. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Verification queries
SELECT 'Tables created:' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

SELECT 'Sample sensors:' as status;
SELECT COUNT(*) as sensor_count FROM public.sensors;

SELECT 'Sample readings:' as status;
SELECT COUNT(*) as reading_count FROM public.sensor_readings;
