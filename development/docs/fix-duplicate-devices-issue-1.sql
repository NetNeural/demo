-- Fix Issue #1: Remove duplicate devices in staging
-- Run this in Supabase SQL Editor for staging environment

-- Step 1: Identify duplicates by name
WITH duplicate_devices AS (
  SELECT 
    name,
    COUNT(*) as count,
    array_agg(id ORDER BY created_at) as device_ids,
    array_agg(created_at ORDER BY created_at) as created_dates,
    array_agg(device_type ORDER BY created_at) as device_types
  FROM devices
  WHERE deleted_at IS NULL
  GROUP BY name
  HAVING COUNT(*) > 1
)
SELECT 
  name,
  count as duplicate_count,
  device_ids,
  device_types,
  created_dates
FROM duplicate_devices
ORDER BY name;

-- Step 2: For each duplicate, keep the FIRST one (oldest) and soft-delete the rest
-- This preserves historical data and telemetry relationships

-- For M260600005: Keep the first (iot-sensor from 2026-02-15T18:30), delete second
UPDATE devices
SET 
  deleted_at = NOW(),
  updated_at = NOW()
WHERE id = '2dfcb0dd-eb27-4666-b126-c656d03ba46d' -- newer duplicate of M260600005
  AND deleted_at IS NULL;

-- For M260600008: Keep the first (iot-sensor from 2026-02-15T02:54), delete second
UPDATE devices
SET 
  deleted_at = NOW(),
  updated_at = NOW()
WHERE id = '22866979-5762-4250-bfbb-2a4a8f4e7618' -- newer duplicate of M260600008
  AND deleted_at IS NULL;

-- Step 3: Verify cleanup
SELECT 
  name,
  COUNT(*) as count
FROM devices
WHERE deleted_at IS NULL
  AND name IN ('M260600005', 'M260600008')
GROUP BY name;

-- Expected result: Each device should have count = 1

-- Step 4: Check if there are any other duplicates
SELECT 
  name,
  COUNT(*) as count
FROM devices
WHERE deleted_at IS NULL
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY count DESC, name;

-- Expected result: No rows (no more duplicates)
