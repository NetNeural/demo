-- Fix Temperature Threshold for Device M260600005
-- Issue: Alert triggering at 32°F but UI shows 40°F
-- Device readings: 2.0-2.9°C (35.6-37.2°F)
-- 
-- This script updates the threshold to prevent false alerts

-- First, let's see what thresholds exist for this device
SELECT 
    st.id,
    d.name as device_name,
    st.sensor_type,
    st.min_value,
    st.max_value,
    st.critical_min,
    st.critical_max,
    st.temperature_unit,
    st.alert_enabled,
    st.created_at
FROM sensor_thresholds st
JOIN devices d ON st.device_id = d.id
WHERE d.name = 'M260600005'
ORDER BY st.created_at DESC;

-- UPDATE THE THRESHOLD
-- Option 1: Set critical_max to 40°F (prevents alerts for readings below 40°F)
UPDATE sensor_thresholds
SET 
    critical_max = 40.0,
    min_value = 33.0,
    max_value = 38.0,
    critical_min = 31.0,
    temperature_unit = 'fahrenheit',
    updated_at = NOW()
WHERE device_id = (SELECT id FROM devices WHERE name = 'M260600005')
  AND sensor_type = 'temperature';

-- Option 2 (Alternative): If you want to use Celsius instead
-- Uncomment this block and comment out Option 1 above
/*
UPDATE sensor_thresholds
SET 
    critical_max = 10.0,  -- 50°F = 10°C
    min_value = 1.0,      -- 33.8°F = 1°C  
    max_value = 4.0,      -- 39.2°F = 4°C
    critical_min = -1.0,  -- 30.2°F = -1°C
    temperature_unit = 'celsius',
    updated_at = NOW()
WHERE device_id = (SELECT id FROM devices WHERE name = 'M260600005')
  AND sensor_type = 'temperature';
*/

-- Verify the update
SELECT 
    st.id,
    d.name as device_name,
    st.sensor_type,
    st.min_value,
    st.max_value,
    st.critical_min,
    st.critical_max,
    st.temperature_unit,
    st.alert_enabled
FROM sensor_thresholds st
JOIN devices d ON st.device_id = d.id
WHERE d.name = 'M260600005'
  AND st.sensor_type = 'temperature';

-- Optional: Resolve any existing alerts from this threshold issue
-- Note: Set resolved_by to NULL since we're doing an automated fix
UPDATE alerts
SET 
    is_resolved = true,
    resolved_at = NOW(),
    resolved_by = NULL
WHERE device_id = (SELECT id FROM devices WHERE name = 'M260600005')
  AND category = 'temperature'
  AND is_resolved = false
  AND message LIKE '%32%';

-- Check recent alerts (should stop appearing after next cron run)
SELECT 
    a.id,
    a.title,
    a.message,
    a.severity,
    a.is_resolved,
    a.created_at,
    (a.metadata->>'current_value')::text as current_value,
    (a.metadata->>'critical_max')::text as critical_max
FROM alerts a
WHERE a.device_id = (SELECT id FROM devices WHERE name = 'M260600005')
  AND a.category = 'temperature'
ORDER BY a.created_at DESC
LIMIT 10;
