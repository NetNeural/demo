-- IoT Dashboard Deployment - Add only missing tables
-- This migration adds IoT dashboard tables without conflicts

-- Create locations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state_province VARCHAR(100),
    country VARCHAR(100) DEFAULT 'USA',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    sensors_total INTEGER DEFAULT 0,
    sensors_online INTEGER DEFAULT 0,
    alerts_active INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sensors table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sensors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('temperature', 'humidity', 'pressure', 'motion', 'air_quality', 'light', 'sound', 'vibration')),
    location VARCHAR(255),
    department VARCHAR(100),
    status VARCHAR(20) DEFAULT 'online' CHECK (status IN ('online', 'offline', 'warning', 'error')),
    current_value DECIMAL(10, 2),
    unit VARCHAR(20),
    battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
    last_reading TIMESTAMPTZ,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create alerts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_id UUID REFERENCES public.sensors(id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL CHECK (level IN ('info', 'warning', 'error', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_active BOOLEAN DEFAULT true,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sensor_readings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sensor_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_id UUID REFERENCES public.sensors(id) ON DELETE CASCADE,
    value DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20),
    reading_time TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes if they don't exist
DO $$ 
BEGIN
    -- Check and create location indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_locations_sensors') THEN
        CREATE INDEX idx_locations_sensors ON public.locations(sensors_total, sensors_online);
    END IF;
    
    -- Check and create sensor indexes  
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sensors_status') THEN
        CREATE INDEX idx_sensors_status ON public.sensors(status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sensors_type') THEN
        CREATE INDEX idx_sensors_type ON public.sensors(type);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sensors_location') THEN
        CREATE INDEX idx_sensors_location ON public.sensors(location);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sensors_last_seen') THEN
        CREATE INDEX idx_sensors_last_seen ON public.sensors(last_seen DESC);
    END IF;
    
    -- Check and create alert indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_alerts_sensor_id') THEN
        CREATE INDEX idx_alerts_sensor_id ON public.alerts(sensor_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_alerts_active') THEN
        CREATE INDEX idx_alerts_active ON public.alerts(is_active) WHERE is_active = true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_alerts_level') THEN
        CREATE INDEX idx_alerts_level ON public.alerts(level);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_alerts_triggered') THEN
        CREATE INDEX idx_alerts_triggered ON public.alerts(triggered_at DESC);
    END IF;
    
    -- Check and create reading indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_readings_sensor_time') THEN
        CREATE INDEX idx_readings_sensor_time ON public.sensor_readings(sensor_id, reading_time DESC);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_readings_time') THEN
        CREATE INDEX idx_readings_time ON public.sensor_readings(reading_time DESC);
    END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users
DO $$
BEGIN
    -- Locations policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'locations_select_authenticated') THEN
        CREATE POLICY locations_select_authenticated ON public.locations FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'locations_insert_authenticated') THEN
        CREATE POLICY locations_insert_authenticated ON public.locations FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'locations_update_authenticated') THEN
        CREATE POLICY locations_update_authenticated ON public.locations FOR UPDATE TO authenticated USING (true);
    END IF;
    
    -- Sensors policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sensors' AND policyname = 'sensors_select_authenticated') THEN
        CREATE POLICY sensors_select_authenticated ON public.sensors FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sensors' AND policyname = 'sensors_insert_authenticated') THEN
        CREATE POLICY sensors_insert_authenticated ON public.sensors FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sensors' AND policyname = 'sensors_update_authenticated') THEN
        CREATE POLICY sensors_update_authenticated ON public.sensors FOR UPDATE TO authenticated USING (true);
    END IF;
    
    -- Alerts policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alerts' AND policyname = 'alerts_select_authenticated') THEN
        CREATE POLICY alerts_select_authenticated ON public.alerts FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alerts' AND policyname = 'alerts_insert_authenticated') THEN
        CREATE POLICY alerts_insert_authenticated ON public.alerts FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alerts' AND policyname = 'alerts_update_authenticated') THEN
        CREATE POLICY alerts_update_authenticated ON public.alerts FOR UPDATE TO authenticated USING (true);
    END IF;
    
    -- Sensor readings policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sensor_readings' AND policyname = 'readings_select_authenticated') THEN
        CREATE POLICY readings_select_authenticated ON public.sensor_readings FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sensor_readings' AND policyname = 'readings_insert_authenticated') THEN
        CREATE POLICY readings_insert_authenticated ON public.sensor_readings FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;
