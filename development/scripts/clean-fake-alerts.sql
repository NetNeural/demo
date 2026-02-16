-- Clean up all fake/generated alert data
-- This will remove all existing alerts from the database
-- After this, only real alerts from sensor thresholds will be created

-- Step 1: Delete all existing alerts
DELETE FROM alerts;

-- Step 2: Delete all alert rules (the old system)
-- These were creating fake alerts via the alert-rules-evaluator
DELETE FROM alert_rules;

-- Step 3: Verify cleanup
SELECT 
  'Alerts remaining: ' || COUNT(*) AS alerts_status
FROM alerts;

SELECT 
  'Alert rules remaining: ' || COUNT(*) AS alert_rules_status  
FROM alert_rules;

-- Step 4: Show current sensor thresholds (the new system)
SELECT 
  st.id,
  d.name AS device_name,
  st.sensor_type,
  st.min_value,
  st.max_value,
  st.critical_min,
  st.critical_max,
  st.alert_enabled,
  st.notify_on_breach,
  COALESCE(array_length(st.notify_user_ids, 1), 0) AS num_users_to_notify,
  COALESCE(array_length(st.notify_emails, 1), 0) AS num_emails_to_notify
FROM sensor_thresholds st
JOIN devices d ON d.id = st.device_id
WHERE st.alert_enabled = true
ORDER BY d.name, st.sensor_type;
