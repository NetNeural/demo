-- Populate Sample Alerts for Staging Environment
-- Run this script to add test alert data for the Alert History Report

-- This script inserts sample alerts for devices in your organization
-- Adjust the organization_id and device_id values based on your actual data

-- First, let's create alerts for existing devices in your organization
-- Replace the placeholders with actual IDs from your staging environment

DO $$
DECLARE
  demo_org_id UUID;
  sample_device_id UUID;
  alert_count INT := 0;
BEGIN
  -- Get the first organization (adjust this query based on your setup)
  SELECT id INTO demo_org_id FROM organizations LIMIT 1;
  
  IF demo_org_id IS NULL THEN
    RAISE NOTICE 'No organization found. Please create an organization first.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Using organization ID: %', demo_org_id;
  
  -- Get a sample device from this organization
  SELECT id INTO sample_device_id FROM devices WHERE organization_id = demo_org_id LIMIT 1;
  
  IF sample_device_id IS NULL THEN
    RAISE NOTICE 'No devices found for this organization. Creating sample alerts without device association.';
  ELSE
    RAISE NOTICE 'Using device ID: %', sample_device_id;
  END IF;
  
  -- Insert sample alerts
  -- Critical Battery Alert
  INSERT INTO alerts (
    organization_id, 
    device_id, 
    alert_type, 
    severity, 
    title, 
    message, 
    is_resolved,
    created_at,
    metadata
  ) VALUES (
    demo_org_id,
    sample_device_id,
    'low_battery',
    'critical',
    'Critical Battery Level',
    'Device battery level is critically low at 15%',
    false,
    NOW() - INTERVAL '2 hours',
    '{"battery_level": 15, "threshold": 20}'::jsonb
  );
  alert_count := alert_count + 1;
  
  -- High Temperature Alert (resolved)
  INSERT INTO alerts (
    organization_id, 
    device_id, 
    alert_type, 
    severity, 
    title, 
    message, 
    is_resolved,
    resolved_at,
    created_at,
    metadata
  ) VALUES (
    demo_org_id,
    sample_device_id,
    'temperature_high',
    'high',
    'High Temperature Alert',
    'Temperature reading exceeded threshold at 32.5°C',
    true,
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '3 hours',
    '{"value": 32.5, "threshold": 30.0, "unit": "°C"}'::jsonb
  );
  alert_count := alert_count + 1;
  
  -- Medium Humidity Alert
  INSERT INTO alerts (
    organization_id, 
    device_id, 
    alert_type, 
    severity, 
    title, 
    message, 
    is_resolved,
    created_at,
    metadata
  ) VALUES (
    demo_org_id,
    sample_device_id,
    'humidity_high',
    'medium',
    'High Humidity Detected',
    'Humidity level is above normal range at 85%',
    false,
    NOW() - INTERVAL '30 minutes',
    '{"value": 85, "threshold": 75, "unit": "%"}'::jsonb
  );
  alert_count := alert_count + 1;
  
  -- Device Offline Alert (resolved)
  INSERT INTO alerts (
    organization_id, 
    device_id, 
    alert_type, 
    severity, 
    title, 
    message, 
    is_resolved,
    resolved_at,
    created_at,
    metadata
  ) VALUES (
    demo_org_id,
    sample_device_id,
    'device_offline',
    'critical',
    'Device Offline',
    'Device has not reported data for over 1 hour',
    true,
    NOW() - INTERVAL '10 minutes',
    NOW() - INTERVAL '2 hours',
    '{"offline_duration": "65 minutes", "last_seen": "' || (NOW() - INTERVAL '2 hours')::text || '"}'::jsonb
  );
  alert_count := alert_count + 1;
  
  -- Low Signal Strength
  INSERT INTO alerts (
    organization_id, 
    device_id, 
    alert_type, 
    severity, 
    title, 
    message, 
    is_resolved,
    created_at,
    metadata
  ) VALUES (
    demo_org_id,
    sample_device_id,
    'signal_weak',
    'low',
    'Weak Signal Strength',
    'Device signal strength is below optimal level',
    false,
    NOW() - INTERVAL '45 minutes',
    '{"signal_strength": -75, "threshold": -65, "unit": "dBm"}'::jsonb
  );
  alert_count := alert_count + 1;
  
  -- Threshold Breach - Pressure High (last 24 hours)
  INSERT INTO alerts (
    organization_id, 
    device_id, 
    alert_type, 
    severity, 
    title, 
    message, 
    is_resolved,
    resolved_at,
    created_at,
    metadata
  ) VALUES (
    demo_org_id,
    sample_device_id,
    'threshold_breach',
    'high',
    'Pressure Threshold Exceeded',
    'Pressure sensor reading exceeded critical threshold',
    true,
    NOW() - INTERVAL '12 hours',
    NOW() - INTERVAL '18 hours',
    '{"value": 1025, "threshold": 1020, "unit": "hPa", "sensor_type": "pressure"}'::jsonb
  );
  alert_count := alert_count + 1;
  
  -- Another Critical Alert from last week
  INSERT INTO alerts (
    organization_id, 
    device_id, 
    alert_type, 
    severity, 
    title, 
    message, 
    is_resolved,
    resolved_at,
    created_at,
    metadata
  ) VALUES (
    demo_org_id,
    sample_device_id,
    'device_offline',
    'critical',
    'Extended Device Offline',
    'Device has been offline for over 4 hours',
    true,
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '7 days',
    '{"offline_duration": "4 hours 25 minutes"}'::jsonb
  );
  alert_count := alert_count + 1;
  
  -- Medium Alert from last month
  INSERT INTO alerts (
    organization_id, 
    device_id, 
    alert_type, 
    severity, 
    title, 
    message, 
    is_resolved,
    resolved_at,
    created_at,
    metadata
  ) VALUES (
    demo_org_id,
    sample_device_id,
    'low_battery',
    'medium',
    'Battery Level Warning',
    'Device battery level is getting low at 45%',
    true,
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '29 days',
    '{"battery_level": 45, "threshold": 50}'::jsonb
  );
  alert_count := alert_count + 1;
  
  RAISE NOTICE 'Successfully inserted % sample alerts', alert_count;
  RAISE NOTICE 'You can now view these alerts in the Alert History Report';
  
END $$;

-- Verify the alerts were created
SELECT 
  COUNT(*) as total_alerts,
  COUNT(CASE WHEN is_resolved THEN 1 END) as resolved,
  COUNT(CASE WHEN NOT is_resolved THEN 1 END) as unresolved,
  COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical,
  COUNT(CASE WHEN severity = 'high' THEN 1 END) as high,
  COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium,
  COUNT(CASE WHEN severity = 'low' THEN 1 END) as low
FROM alerts
WHERE organization_id IN (SELECT id FROM organizations LIMIT 1);
