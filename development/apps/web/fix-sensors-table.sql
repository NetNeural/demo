-- Quick Fix for Missing Columns in Sensors Table
-- Run this FIRST if you get the "column does not exist" error

-- Step 1: Check current sensors table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sensors' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Add missing columns to sensors table
DO $$ 
BEGIN
    -- Add device_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sensors' AND column_name='device_id' AND table_schema='public') THEN
        ALTER TABLE public.sensors ADD COLUMN device_id TEXT;
        RAISE NOTICE 'Added device_id column to sensors table';
    ELSE
        RAISE NOTICE 'device_id column already exists in sensors table';
    END IF;
    
    -- Add status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sensors' AND column_name='status' AND table_schema='public') THEN
        ALTER TABLE public.sensors ADD COLUMN status TEXT DEFAULT 'active';
        RAISE NOTICE 'Added status column to sensors table';
    ELSE
        RAISE NOTICE 'status column already exists in sensors table';
    END IF;
    
    -- Add metadata column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sensors' AND column_name='metadata' AND table_schema='public') THEN
        ALTER TABLE public.sensors ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added metadata column to sensors table';
    ELSE
        RAISE NOTICE 'metadata column already exists in sensors table';
    END IF;
END $$;

-- Step 3: Verify the table structure after fixes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'sensors' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 4: Now try inserting sample data
INSERT INTO public.sensors (name, type, location, device_id, status) VALUES
  ('Temperature Sensor 1', 'temperature', 'Living Room', 'device_001', 'active'),
  ('Humidity Sensor 1', 'humidity', 'Living Room', 'device_001', 'active'),
  ('Motion Sensor 1', 'motion', 'Front Door', 'device_002', 'active'),
  ('Light Sensor 1', 'light', 'Kitchen', 'device_003', 'active')
ON CONFLICT DO NOTHING;

-- Step 5: Verify data was inserted
SELECT COUNT(*) as sensor_count FROM public.sensors;
SELECT * FROM public.sensors LIMIT 5;
