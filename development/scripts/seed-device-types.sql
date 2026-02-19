-- ============================================================================
-- Seed Script: Common IoT Device Types with Industry Standards
-- ============================================================================
-- Run this against your Supabase database to populate device_types with
-- standard IoT sensor configurations.
--
-- Usage:
--   1. Replace 'YOUR_ORG_ID_HERE' with your actual organization UUID
--   2. Run via Supabase SQL Editor or: psql -f seed-device-types.sql
--
-- Standards based on:
--   - ASHRAE 55 (thermal comfort)
--   - WHO Air Quality Guidelines
--   - NIST/ANSI standards for industrial sensors
--   - Common IoT best practices
-- ============================================================================

-- ⚠️ IMPORTANT: Replace this with your organization's UUID
-- You can find it by running: SELECT id, name FROM organizations;
\set org_id 'YOUR_ORG_ID_HERE'

-- Delete existing device types for clean slate (optional)
-- DELETE FROM device_types WHERE organization_id = :'org_id';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Temperature Sensors                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO device_types (organization_id, name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits)
VALUES
  -- Indoor Temperature (Celsius)
  (:'org_id', 'Indoor Temperature (°C)', 'Standard indoor environment monitoring per ASHRAE 55', 'temperature', '°C', 18.0, 26.0, 10.0, 35.0, 1),
  
  -- Indoor Temperature (Fahrenheit)
  (:'org_id', 'Indoor Temperature (°F)', 'Standard indoor environment monitoring (imperial)', 'temperature', '°F', 64.0, 79.0, 50.0, 95.0, 1),
  
  -- Cold Storage
  (:'org_id', 'Cold Storage Temperature', 'Food safety cold chain monitoring (FDA guidelines)', 'temperature', '°C', 0.0, 4.0, -5.0, 10.0, 1),
  
  -- Freezer
  (:'org_id', 'Freezer Temperature', 'Deep freeze monitoring for food/pharma safety', 'temperature', '°C', -25.0, -15.0, -35.0, -10.0, 1),
  
  -- Server Room
  (:'org_id', 'Server Room Temperature', 'Data center thermal management (ASHRAE TC 9.9)', 'temperature', '°C', 18.0, 27.0, 15.0, 32.0, 1),
  
  -- Industrial Process
  (:'org_id', 'Industrial Process Temperature', 'High-temperature industrial monitoring', 'temperature', '°C', 20.0, 80.0, 0.0, 120.0, 1);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Humidity Sensors                                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO device_types (organization_id, name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits)
VALUES
  -- Indoor Humidity
  (:'org_id', 'Indoor Humidity', 'Comfort range per ASHRAE 55 (30-60% RH)', 'humidity', '% RH', 30.0, 60.0, 20.0, 80.0, 1),
  
  -- Data Center Humidity
  (:'org_id', 'Data Center Humidity', 'Server room humidity control (ASHRAE TC 9.9)', 'humidity', '% RH', 40.0, 55.0, 20.0, 80.0, 1),
  
  -- Museum/Archive
  (:'org_id', 'Museum Climate Control', 'Artifact preservation humidity (strict control)', 'humidity', '% RH', 45.0, 55.0, 30.0, 70.0, 1),
  
  -- Greenhouse
  (:'org_id', 'Greenhouse Humidity', 'Agricultural greenhouse climate monitoring', 'humidity', '% RH', 60.0, 80.0, 40.0, 95.0, 1);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Air Quality Sensors                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO device_types (organization_id, name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits)
VALUES
  -- CO2
  (:'org_id', 'CO₂ Concentration', 'Indoor air quality (ASHRAE 62.1: <1000 ppm good)', 'air_quality', 'ppm', 400.0, 1000.0, 300.0, 2000.0, 0),
  
  -- VOC
  (:'org_id', 'VOC (Volatile Organic Compounds)', 'Indoor air pollutants per WHO guidelines', 'air_quality', 'ppb', 0.0, 500.0, NULL, 1000.0, 0),
  
  -- PM2.5
  (:'org_id', 'PM2.5 Particulate Matter', 'Fine particles per WHO Air Quality Guidelines', 'air_quality', 'µg/m³', 0.0, 25.0, NULL, 75.0, 1),
  
  -- PM10
  (:'org_id', 'PM10 Particulate Matter', 'Coarse particles per WHO Air Quality Guidelines', 'air_quality', 'µg/m³', 0.0, 50.0, NULL, 150.0, 1);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Light Sensors                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO device_types (organization_id, name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits)
VALUES
  -- Office Lighting
  (:'org_id', 'Office Illuminance', 'Workspace lighting per IESNA standards (500 lux)', 'illuminance', 'lux', 300.0, 750.0, 100.0, 1500.0, 0),
  
  -- Outdoor Light
  (:'org_id', 'Outdoor Light Level', 'Daylight/security monitoring (0-100k lux)', 'illuminance', 'lux', 0.0, 100000.0, NULL, NULL, 0),
  
  -- Warehouse
  (:'org_id', 'Warehouse Illuminance', 'Industrial warehouse lighting (200 lux minimum)', 'illuminance', 'lux', 150.0, 300.0, 50.0, 750.0, 0);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Pressure Sensors                                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO device_types (organization_id, name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits)
VALUES
  -- Barometric Pressure
  (:'org_id', 'Atmospheric Pressure', 'Weather monitoring (sea level: ~1013 hPa)', 'pressure', 'hPa', 980.0, 1040.0, 950.0, 1070.0, 1),
  
  -- Clean Room Differential
  (:'org_id', 'Clean Room Pressure Differential', 'Positive pressure monitoring for contamination control', 'pressure', 'Pa', 5.0, 20.0, 0.0, 50.0, 1),
  
  -- HVAC Duct Pressure
  (:'org_id', 'HVAC Duct Pressure', 'Building ventilation system monitoring', 'pressure', 'Pa', 50.0, 500.0, 0.0, 1000.0, 0);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Power & Battery Sensors                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO device_types (organization_id, name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits)
VALUES
  -- Battery Level
  (:'org_id', 'Battery Level', 'Device battery state of charge', 'battery', '%', 20.0, 100.0, 10.0, NULL, 0),
  
  -- AC Voltage (120V)
  (:'org_id', 'AC Voltage (120V)', 'North American mains voltage monitoring', 'voltage', 'V', 114.0, 126.0, 108.0, 132.0, 1),
  
  -- AC Voltage (230V)
  (:'org_id', 'AC Voltage (230V)', 'European/International mains voltage', 'voltage', 'V', 220.0, 240.0, 207.0, 253.0, 1),
  
  -- DC Power Supply
  (:'org_id', 'DC Power Supply (12V)', 'Low-voltage DC power monitoring', 'voltage', 'V', 11.5, 12.5, 10.0, 14.0, 2),
  
  -- Current Draw
  (:'org_id', 'Current Draw', 'Electrical current consumption monitoring', 'current', 'A', 0.0, 10.0, NULL, 15.0, 2),
  
  -- Power Consumption
  (:'org_id', 'Power Consumption', 'Active power usage monitoring', 'power', 'W', 0.0, 1000.0, NULL, 2000.0, 1);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Motion & Occupancy                                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO device_types (organization_id, name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits)
VALUES
  -- Occupancy Count
  (:'org_id', 'Occupancy Count', 'People counting for space utilization', 'occupancy', 'people', 0.0, 50.0, NULL, 100.0, 0),
  
  -- Motion Events
  (:'org_id', 'Motion Events (Hourly)', 'Motion detection frequency for security/analytics', 'motion', 'events/hr', 0.0, 100.0, NULL, 500.0, 0);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Water & Liquid Sensors                                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO device_types (organization_id, name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits)
VALUES
  -- Water Leak Detection
  (:'org_id', 'Water Leak Detection', 'Binary leak sensor (0=dry, 1=wet)', 'leak_detection', 'status', 0.0, 0.1, NULL, 1.0, 0),
  
  -- Flow Rate
  (:'org_id', 'Water Flow Rate', 'Liquid flow monitoring for pipes/systems', 'flow', 'L/min', 0.0, 100.0, NULL, 200.0, 1),
  
  -- Tank Level
  (:'org_id', 'Tank Level', 'Liquid storage tank level monitoring', 'level', '%', 20.0, 100.0, 10.0, NULL, 1);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Connectivity & Signal                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO device_types (organization_id, name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits)
VALUES
  -- RSSI (WiFi/Cellular)
  (:'org_id', 'Signal Strength (RSSI)', 'Wireless signal quality (-30 dBm excellent, -90 dBm poor)', 'signal', 'dBm', -80.0, -30.0, -100.0, NULL, 0),
  
  -- Link Quality
  (:'org_id', 'Link Quality', 'Network connection quality percentage', 'signal', '%', 70.0, 100.0, 30.0, NULL, 0);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Environmental & Weather                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO device_types (organization_id, name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits)
VALUES
  -- Wind Speed
  (:'org_id', 'Wind Speed', 'Anemometer monitoring for weather stations', 'wind', 'm/s', 0.0, 5.0, NULL, 20.0, 1),
  
  -- Rainfall
  (:'org_id', 'Rainfall Rate', 'Precipitation measurement (hourly)', 'precipitation', 'mm/hr', 0.0, 10.0, NULL, 50.0, 1),
  
  -- Soil Moisture
  (:'org_id', 'Soil Moisture', 'Agricultural soil water content monitoring', 'moisture', '%', 20.0, 60.0, 10.0, 80.0, 1),
  
  -- UV Index
  (:'org_id', 'UV Index', 'Ultraviolet radiation level (0-2 low, 11+ extreme)', 'radiation', 'index', 0.0, 11.0, NULL, NULL, 1);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Industrial & Specialized                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

INSERT INTO device_types (organization_id, name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits)
VALUES
  -- Vibration
  (:'org_id', 'Vibration Level', 'Machinery condition monitoring (RMS acceleration)', 'vibration', 'mm/s', 0.0, 4.5, NULL, 18.0, 2),
  
  -- Sound Level
  (:'org_id', 'Sound Pressure Level', 'Noise monitoring (OSHA: 85 dB 8-hour limit)', 'sound', 'dB', 30.0, 70.0, NULL, 90.0, 1),
  
  -- Distance/Proximity
  (:'org_id', 'Distance Measurement', 'Ultrasonic/laser distance sensor', 'distance', 'cm', 0.0, 400.0, NULL, NULL, 1),
  
  -- Weight/Load
  (:'org_id', 'Weight/Load', 'Load cell or scale monitoring', 'weight', 'kg', 0.0, 1000.0, NULL, 1500.0, 1),
  
  -- Gas Concentration
  (:'org_id', 'Gas Concentration (Generic)', 'Generic gas sensor (calibrate per gas type)', 'gas', 'ppm', 0.0, 50.0, NULL, 1000.0, 0);

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to confirm all device types were created:
-- SELECT name, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert
-- FROM device_types
-- WHERE organization_id = :'org_id'
-- ORDER BY device_class, name;
