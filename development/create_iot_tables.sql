-- Direct IoT table creation for deployment
-- Run this directly in Supabase SQL Editor to bypass migration conflicts

-- Create IoT tables directly
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

CREATE TABLE IF NOT EXISTS public.sensor_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_id UUID REFERENCES public.sensors(id) ON DELETE CASCADE,
    value DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20),
    reading_time TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sensors_status ON public.sensors(status);
CREATE INDEX IF NOT EXISTS idx_sensors_type ON public.sensors(type);
CREATE INDEX IF NOT EXISTS idx_sensors_location ON public.sensors(location);
CREATE INDEX IF NOT EXISTS idx_alerts_sensor_id ON public.alerts(sensor_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON public.alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_readings_sensor_time ON public.sensor_readings(sensor_id, reading_time DESC);

-- Enable RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

-- Create simple policies for demo (allow all authenticated users)
DROP POLICY IF EXISTS locations_all ON public.locations;
CREATE POLICY locations_all ON public.locations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sensors_all ON public.sensors;
CREATE POLICY sensors_all ON public.sensors FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS alerts_all ON public.alerts;
CREATE POLICY alerts_all ON public.alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS readings_all ON public.sensor_readings;
CREATE POLICY readings_all ON public.sensor_readings FOR ALL TO authenticated USING (true) WITH CHECK (true);
