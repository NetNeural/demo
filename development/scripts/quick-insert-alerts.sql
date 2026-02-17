-- Quick insert alerts for testing Alert History Report
-- Copy and paste this entire script into Supabase SQL Editor

DO $$
DECLARE
  target_org_id UUID;
  sample_device_id UUID;
BEGIN
  -- Get your organization ID
  SELECT id INTO target_org_id FROM organizations ORDER BY created_at DESC LIMIT 1;
  
  IF target_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Create an organization first.';
  END IF;
  
  RAISE NOTICE 'Using organization: %', target_org_id;
  
  -- Get a device (optional - alerts can exist without devices)
  SELECT id INTO sample_device_id FROM devices WHERE organization_id = target_org_id LIMIT 1;
  
  IF sample_device_id IS NULL THEN
    RAISE NOTICE 'No devices found. Creating alerts without device association.';
  ELSE
    RAISE NOTICE 'Using device: %', sample_device_id;
  END IF;
  
  -- Insert 10 test alerts with variety of statuses and severities
  
  -- Critical unresolved (recent)
  INSERT INTO alerts (organization_id, device_id, alert_type, severity, title, message, is_resolved, created_at) 
  VALUES (target_org_id, sample_device_id, 'low_battery', 'critical', 'Critical Battery Alert', 'Battery at 10%', false, NOW() - INTERVAL '30 minutes');
  
  INSERT INTO alerts (organization_id, device_id, alert_type, severity, title, message, is_resolved, created_at) 
  VALUES (target_org_id, sample_device_id, 'device_offline', 'critical', 'Device Offline', 'Device not responding', false, NOW() - INTERVAL '2 hours');
  
  -- High severity resolved
  INSERT INTO alerts (organization_id, device_id, alert_type, severity, title, message, is_resolved, resolved_at, created_at) 
  VALUES (target_org_id, sample_device_id, 'temperature_high', 'high', 'High Temperature', 'Temp exceeded 30°C', true, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '3 hours');
  
  INSERT INTO alerts (organization_id, device_id, alert_type, severity, title, message, is_resolved, resolved_at, created_at) 
  VALUES (target_org_id, sample_device_id, 'threshold_breach', 'high', 'Threshold Breach', 'Pressure sensor alert', true, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '6 hours');
  
  -- Medium severity
  INSERT INTO alerts (organization_id, device_id, alert_type, severity, title, message, is_resolved, created_at) 
  VALUES (target_org_id, sample_device_id, 'humidity_high', 'medium', 'High Humidity', 'Humidity at 85%', false, NOW() - INTERVAL '1 hour');
  
  INSERT INTO alerts (organization_id, device_id, alert_type, severity, title, message, is_resolved, resolved_at, created_at) 
  VALUES (target_org_id, sample_device_id, 'signal_weak', 'medium', 'Weak Signal', 'Signal strength low', true, NOW() - INTERVAL '12 hours', NOW() - INTERVAL '1 day');
  
  -- Low severity
  INSERT INTO alerts (organization_id, device_id, alert_type, severity, title, message, is_resolved, created_at) 
  VALUES (target_org_id, sample_device_id, 'maintenance_due', 'low', 'Maintenance Due', 'Schedule maintenance soon', false, NOW() - INTERVAL '2 days');
  
  -- Older alerts (last week)
  INSERT INTO alerts (organization_id, device_id, alert_type, severity, title, message, is_resolved, resolved_at, created_at) 
  VALUES (target_org_id, sample_device_id, 'device_offline', 'critical', 'Extended Offline', 'Device offline 4+ hours', true, NOW() - INTERVAL '5 days', NOW() - INTERVAL '6 days');
  
  INSERT INTO alerts (organization_id, device_id, alert_type, severity, title, message, is_resolved, resolved_at, created_at) 
  VALUES (target_org_id, sample_device_id, 'low_battery', 'high', 'Battery Warning', 'Battery below 50%', true, NOW() - INTERVAL '7 days', NOW() - INTERVAL '8 days');
  
  -- Last month
  INSERT INTO alerts (organization_id, device_id, alert_type, severity, title, message, is_resolved, resolved_at, created_at) 
  VALUES (target_org_id, sample_device_id, 'threshold_breach', 'medium', 'Threshold Alert', 'Minor threshold breach', true, NOW() - INTERVAL '25 days', NOW() - INTERVAL '26 days');
  
  RAISE NOTICE '✅ Successfully inserted 10 test alerts';
END $$;

-- Verify the alerts
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical,
  COUNT(CASE WHEN severity = 'high' THEN 1 END) as high,
  COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium,
  COUNT(CASE WHEN severity = 'low' THEN 1 END) as low,
  COUNT(CASE WHEN is_resolved THEN 1 END) as resolved,
  COUNT(CASE WHEN NOT is_resolved THEN 1 END) as unresolved
FROM alerts;

-- Show the alerts
SELECT 
  id,
  title,
  severity,
  is_resolved,
  created_at,
  organization_id
FROM alerts
ORDER BY created_at DESC
LIMIT 10;
