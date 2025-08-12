-- Test database connection and verify tables
SELECT 'Tables created successfully!' as status;

-- Check that all our tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('locations', 'sensors', 'alerts', 'sensor_readings')
ORDER BY table_name;
