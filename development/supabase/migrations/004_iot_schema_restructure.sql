-- IoT Sensor Management Platform Database Schema
-- Restructured for hierarchical sensor organization: Org → Subsidiary → Location → Department → Sensor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis" CASCADE; -- For geographic data

-- Create custom types for IoT platform
CREATE TYPE sensor_status AS ENUM ('online', 'offline', 'warning', 'error', 'maintenance');
CREATE TYPE alert_level AS ENUM ('green', 'yellow', 'red', 'critical');
CREATE TYPE sensor_type AS ENUM ('temperature', 'humidity', 'door', 'motion', 'pressure', 'light', 'air_quality');
CREATE TYPE notification_method AS ENUM ('email', 'sms', 'push', 'webhook');

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    phone_number TEXT,
    timezone TEXT DEFAULT 'UTC',
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "push": true}'::jsonb,
    role TEXT DEFAULT 'user' CHECK (role IN ('master_admin', 'org_admin', 'location_manager', 'department_manager', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organizations table (top level - e.g., Kroger)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    headquarters_address TEXT,
    settings JSONB DEFAULT '{
        "timezone": "UTC",
        "alert_retention_days": 90,
        "notification_settings": {
            "email_enabled": true,
            "sms_enabled": false
        }
    }'::jsonb,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subsidiaries table (e.g., Fred Meyer, Ralphs under Kroger)
CREATE TABLE IF NOT EXISTS public.subsidiaries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    headquarters_address TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, slug)
);

-- Create locations table (specific stores/facilities)
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subsidiary_id UUID REFERENCES public.subsidiaries(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state_province TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'US',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    timezone TEXT DEFAULT 'UTC',
    store_number TEXT,
    phone_number TEXT,
    manager_email TEXT,
    settings JSONB DEFAULT '{
        "operating_hours": {
            "monday": {"open": "09:00", "close": "21:00"},
            "tuesday": {"open": "09:00", "close": "21:00"},
            "wednesday": {"open": "09:00", "close": "21:00"},
            "thursday": {"open": "09:00", "close": "21:00"},
            "friday": {"open": "09:00", "close": "21:00"},
            "saturday": {"open": "09:00", "close": "21:00"},
            "sunday": {"open": "10:00", "close": "20:00"}
        }
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create departments table (e.g., Pharmacy, Produce, Electronics)
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    floor_level INTEGER DEFAULT 1,
    area_square_feet INTEGER,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create gateways table (IoT data collection hubs)
CREATE TABLE IF NOT EXISTS public.gateways (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    mac_address TEXT UNIQUE NOT NULL,
    ip_address INET,
    firmware_version TEXT,
    status sensor_status DEFAULT 'offline',
    last_seen TIMESTAMP WITH TIME ZONE,
    golioth_device_id TEXT UNIQUE,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sensors table (individual sensor devices)
CREATE TABLE IF NOT EXISTS public.sensors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    gateway_id UUID REFERENCES public.gateways(id) ON DELETE CASCADE NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    sensor_type sensor_type NOT NULL,
    model TEXT,
    serial_number TEXT UNIQUE,
    golioth_device_id TEXT UNIQUE,
    status sensor_status DEFAULT 'offline',
    battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
    last_reading TIMESTAMP WITH TIME ZONE,
    last_seen TIMESTAMP WITH TIME ZONE,
    position_x DECIMAL(10, 2), -- Position within department
    position_y DECIMAL(10, 2), -- Position within department
    calibration_offset DECIMAL(10, 4) DEFAULT 0,
    settings JSONB DEFAULT '{
        "reading_interval_seconds": 300,
        "alert_thresholds": {}
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sensor_readings table (time-series sensor data)
CREATE TABLE IF NOT EXISTS public.sensor_readings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sensor_id UUID REFERENCES public.sensors(id) ON DELETE CASCADE NOT NULL,
    reading_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    value DECIMAL(10, 4) NOT NULL,
    unit TEXT NOT NULL, -- e.g., 'celsius', 'fahrenheit', 'percent', 'ppm'
    raw_value DECIMAL(10, 4), -- Pre-calibration value
    quality_score INTEGER DEFAULT 100 CHECK (quality_score >= 0 AND quality_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create alert_rules table (threshold configurations)
CREATE TABLE IF NOT EXISTS public.alert_rules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sensor_id UUID REFERENCES public.sensors(id) ON DELETE CASCADE,
    sensor_type sensor_type, -- For type-wide rules
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    alert_level alert_level NOT NULL,
    condition_type TEXT NOT NULL CHECK (condition_type IN ('greater_than', 'less_than', 'equals', 'range', 'no_data')),
    threshold_value DECIMAL(10, 4),
    threshold_min DECIMAL(10, 4), -- For range conditions
    threshold_max DECIMAL(10, 4), -- For range conditions
    duration_minutes INTEGER DEFAULT 0, -- How long condition must persist
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK ((sensor_id IS NOT NULL) OR (sensor_type IS NOT NULL)) -- Rule applies to specific sensor or sensor type
);

-- Create alerts table (active/historical alerts)
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    alert_rule_id UUID REFERENCES public.alert_rules(id) ON DELETE CASCADE NOT NULL,
    sensor_id UUID REFERENCES public.sensors(id) ON DELETE CASCADE NOT NULL,
    alert_level alert_level NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    trigger_value DECIMAL(10, 4),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create notification_recipients table (who gets notified)
CREATE TABLE IF NOT EXISTS public.notification_recipients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    alert_rule_id UUID REFERENCES public.alert_rules(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    email TEXT,
    phone_number TEXT,
    notification_method notification_method NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK ((user_id IS NOT NULL) OR (email IS NOT NULL) OR (phone_number IS NOT NULL))
);

-- Create user_permissions table (granular access control)
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    subsidiary_id UUID REFERENCES public.subsidiaries(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'viewer')),
    permissions JSONB DEFAULT '[]'::jsonb,
    granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, organization_id, subsidiary_id, location_id, department_id)
);

-- Create activity_logs table (audit trail)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_time ON public.sensor_readings(sensor_id, reading_time DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_time ON public.sensor_readings(reading_time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_sensor_active ON public.alerts(sensor_id, is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON public.alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensors_status ON public.sensors(status);
CREATE INDEX IF NOT EXISTS idx_sensors_type ON public.sensors(sensor_type);
CREATE INDEX IF NOT EXISTS idx_gateways_status ON public.gateways(status);
CREATE INDEX IF NOT EXISTS idx_locations_coordinates ON public.locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON public.user_permissions(user_id);
-- Commented out temporarily - will be added in migration 006
-- CREATE INDEX IF NOT EXISTS idx_activity_logs_org_time ON public.activity_logs(organization_id, created_at DESC);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER handle_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_subsidiaries_updated_at BEFORE UPDATE ON public.subsidiaries FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_gateways_updated_at BEFORE UPDATE ON public.gateways FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_sensors_updated_at BEFORE UPDATE ON public.sensors FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_alert_rules_updated_at BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subsidiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Organizations policies (users can only see orgs they have access to)
CREATE POLICY "Users can view accessible organizations" ON public.organizations
FOR SELECT USING (
    id IN (
        SELECT COALESCE(up.organization_id, org.id) 
        FROM public.user_permissions up
        RIGHT JOIN public.organizations org ON up.organization_id = org.id
        WHERE up.user_id = auth.uid() OR org.owner_id = auth.uid()
    )
);

-- More RLS policies will be added for full security implementation...
