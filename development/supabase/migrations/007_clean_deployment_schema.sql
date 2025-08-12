-- Clean IoT Dashboard Schema for Deployment
-- Simplified schema focused on sensor dashboard functionality

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types for sensor management
CREATE TYPE sensor_status AS ENUM ('online', 'offline', 'warning', 'error', 'maintenance');
CREATE TYPE sensor_type AS ENUM ('temperature', 'humidity', 'motion', 'pressure', 'air_quality');
CREATE TYPE alert_level AS ENUM ('info', 'warning', 'error', 'critical');

-- Create locations table (simplified for dashboard)
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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

-- Create sensors table (simplified for dashboard)
CREATE TABLE IF NOT EXISTS public.sensors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    type sensor_type NOT NULL,
    location TEXT NOT NULL,
    department TEXT,
    status sensor_status DEFAULT 'offline',
    current_value DECIMAL(10, 4),
    unit TEXT,
    battery_level INTEGER DEFAULT 100,
    last_reading TIMESTAMP WITH TIME ZONE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sensor_readings table for historical data
CREATE TABLE IF NOT EXISTS public.sensor_readings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sensor_id UUID REFERENCES public.sensors(id) ON DELETE CASCADE NOT NULL,
    value DECIMAL(10, 4) NOT NULL,
    unit TEXT,
    reading_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sensor_id UUID REFERENCES public.sensors(id) ON DELETE CASCADE NOT NULL,
    level alert_level NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    acknowledged BOOLEAN DEFAULT FALSE,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sensors_status ON public.sensors(status);
CREATE INDEX IF NOT EXISTS idx_sensors_type ON public.sensors(type);
CREATE INDEX IF NOT EXISTS idx_sensors_location ON public.sensors(location);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_time ON public.sensor_readings(sensor_id, reading_time DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_time ON public.sensor_readings(reading_time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_sensor_active ON public.alerts(sensor_id, is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON public.alerts(triggered_at DESC);

-- Create updated_at function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers
CREATE TRIGGER handle_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_sensors_updated_at BEFORE UPDATE ON public.sensors FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security (optional, for future security)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Create simple policies to allow read access (for now)
CREATE POLICY "Allow public read access to locations" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Allow public read access to sensors" ON public.sensors FOR SELECT USING (true);
CREATE POLICY "Allow public read access to sensor_readings" ON public.sensor_readings FOR SELECT USING (true);
CREATE POLICY "Allow public read access to alerts" ON public.alerts FOR SELECT USING (true);
