-- Add phone sensor device types to the seed function
-- Issue #528: Phone as IoT Device
-- Adds 9 smartphone-class device types for phone sensor data

-- Update the seed function to include phone sensor types (now 51 total)
CREATE OR REPLACE FUNCTION seed_organization_device_types(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert all standard device types for the organization
  INSERT INTO device_types (organization_id, name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits) VALUES
    -- Temperature Sensors (6)
    (org_id, 'Indoor Temperature (°C)', 'Standard indoor environment monitoring per ASHRAE 55', 'temperature', '°C', 18.0, 26.0, 10.0, 35.0, 1),
    (org_id, 'Indoor Temperature (°F)', 'Standard indoor environment monitoring (imperial)', 'temperature', '°F', 64.0, 79.0, 50.0, 95.0, 1),
    (org_id, 'Cold Storage Temperature', 'Food safety cold chain monitoring (FDA guidelines)', 'temperature', '°C', 0.0, 4.0, -5.0, 10.0, 1),
    (org_id, 'Freezer Temperature', 'Deep freeze monitoring for food/pharma safety', 'temperature', '°C', -25.0, -15.0, -35.0, -10.0, 1),
    (org_id, 'Server Room Temperature', 'Data center thermal management (ASHRAE TC 9.9)', 'temperature', '°C', 18.0, 27.0, 15.0, 32.0, 1),
    (org_id, 'Industrial Process Temperature', 'High-temperature industrial monitoring', 'temperature', '°C', 20.0, 80.0, 0.0, 120.0, 1),

    -- Humidity Sensors (4)
    (org_id, 'Indoor Humidity', 'Comfort range per ASHRAE 55 (30-60% RH)', 'humidity', '% RH', 30.0, 60.0, 20.0, 80.0, 1),
    (org_id, 'Data Center Humidity', 'Server room humidity control (ASHRAE TC 9.9)', 'humidity', '% RH', 40.0, 60.0, 20.0, 80.0, 1),
    (org_id, 'Cold Storage Humidity', 'Refrigerated environment moisture monitoring', 'humidity', '% RH', 75.0, 95.0, 60.0, 100.0, 1),
    (org_id, 'Manufacturing Humidity', 'Industrial process humidity control', 'humidity', '% RH', 30.0, 70.0, 10.0, 90.0, 1),

    -- Pressure Sensors (3)
    (org_id, 'Atmospheric Pressure', 'Barometric pressure for weather monitoring', 'pressure', 'hPa', 980.0, 1030.0, 950.0, 1050.0, 1),
    (org_id, 'Cleanroom Differential Pressure', 'ISO 14644 cleanroom compliance', 'pressure', 'Pa', 5.0, 20.0, 0.0, 30.0, 1),
    (org_id, 'HVAC System Pressure', 'Building management system monitoring', 'pressure', 'Pa', -50.0, 50.0, -100.0, 100.0, 1),

    -- Air Quality Sensors (8)
    (org_id, 'CO₂ Concentration', 'Indoor air quality per ASHRAE 62.1 (≤1000ppm)', 'air_quality', 'ppm', 400.0, 1000.0, 350.0, 2000.0, 0),
    (org_id, 'CO Concentration', 'Carbon monoxide safety (OSHA PEL: 50ppm)', 'air_quality', 'ppm', 0.0, 9.0, 0.0, 50.0, 1),
    (org_id, 'PM2.5 Particulate', 'Fine particulate matter (WHO: ≤15 μg/m³)', 'air_quality', 'µg/m³', 0.0, 15.0, 0.0, 35.0, 1),
    (org_id, 'PM10 Particulate', 'Coarse particulate matter (WHO: ≤45 μg/m³)', 'air_quality', 'µg/m³', 0.0, 45.0, 0.0, 150.0, 1),
    (org_id, 'VOC (Volatile Organic Compounds)', 'Total VOC indoor air quality', 'air_quality', 'ppb', 0.0, 500.0, 0.0, 2000.0, 0),
    (org_id, 'Ozone (O₃)', 'Ground-level ozone (EPA: ≤70ppb)', 'air_quality', 'ppb', 0.0, 70.0, 0.0, 150.0, 0),
    (org_id, 'Formaldehyde (HCHO)', 'Indoor air toxin monitoring', 'air_quality', 'ppb', 0.0, 30.0, 0.0, 100.0, 1),
    (org_id, 'Radon', 'Radioactive gas monitoring (EPA: <4pCi/L)', 'air_quality', 'pCi/L', 0.0, 4.0, 0.0, 10.0, 1),

    -- Light/Illuminance (2)
    (org_id, 'Indoor Illuminance', 'Office lighting per IES standards (300-500 lux)', 'illuminance', 'lux', 300.0, 500.0, 100.0, 1000.0, 0),
    (org_id, 'Outdoor Illuminance', 'Daylight monitoring for smart controls', 'illuminance', 'lux', 10000.0, 100000.0, 0.0, 120000.0, 0),

    -- Electrical (6)
    (org_id, 'AC Voltage (120V)', 'Standard US outlet monitoring', 'voltage', 'V', 110.0, 125.0, 100.0, 130.0, 1),
    (org_id, 'AC Voltage (230V)', 'Standard EU/international outlet', 'voltage', 'V', 220.0, 240.0, 200.0, 250.0, 1),
    (org_id, 'DC Voltage (12V)', 'Low-voltage DC systems', 'voltage', 'V', 11.0, 13.0, 10.0, 15.0, 2),
    (org_id, 'Current Draw', 'Electrical current monitoring', 'current', 'A', 0.0, 15.0, 0.0, 20.0, 2),
    (org_id, 'Power Consumption', 'Active power usage', 'power', 'W', 0.0, 1500.0, 0.0, 3000.0, 1),
    (org_id, 'Battery Level', 'Device battery state of charge', 'other', '%', 20.0, 100.0, 10.0, 100.0, 0),

    -- Motion/Occupancy (2)
    (org_id, 'Occupancy (Binary)', 'PIR motion/people detection', 'other', 'boolean', 0.0, 1.0, 0.0, 1.0, 0),
    (org_id, 'People Count', 'IR/camera-based occupancy counting', 'other', 'count', 0.0, 50.0, 0.0, 100.0, 0),

    -- Water/Liquid (3)
    (org_id, 'Water Flow Rate', 'Plumbing/irrigation flow monitoring', 'flow', 'L/min', 0.5, 20.0, 0.0, 50.0, 1),
    (org_id, 'Water Leak Detection', 'Binary leak alarm', 'other', 'boolean', 0.0, 1.0, 0.0, 1.0, 0),
    (org_id, 'Liquid Level', 'Tank/reservoir level monitoring', 'level', '%', 10.0, 90.0, 0.0, 100.0, 1),

    -- Sound (1)
    (org_id, 'Sound Level (dBA)', 'Noise pollution monitoring (OSHA: <85dBA)', 'other', 'dBA', 30.0, 85.0, 0.0, 120.0, 1),

    -- Vibration (1)
    (org_id, 'Vibration (RMS)', 'Industrial equipment condition monitoring', 'other', 'mm/s', 0.0, 10.0, 0.0, 50.0, 2),

    -- Distance/Proximity (2)
    (org_id, 'Ultrasonic Distance', 'Proximity/level measurement', 'distance', 'cm', 5.0, 400.0, 0.0, 500.0, 1),
    (org_id, 'Time-of-Flight Distance', 'Precision laser ranging', 'distance', 'mm', 30.0, 4000.0, 0.0, 5000.0, 0),

    -- Environmental (2)
    (org_id, 'Soil Moisture', 'Agriculture/landscaping monitoring', 'other', '% VWC', 20.0, 60.0, 10.0, 80.0, 1),
    (org_id, 'Wind Speed', 'Weather station anemometer', 'speed', 'm/s', 0.0, 20.0, 0.0, 50.0, 1),

    -- Safety (2)
    (org_id, 'Smoke Detection', 'Fire safety alarm (UL 217/268)', 'other', 'boolean', 0.0, 1.0, 0.0, 1.0, 0),
    (org_id, 'Natural Gas (Methane)', 'Combustible gas safety (LEL%)', 'air_quality', '% LEL', 0.0, 10.0, 0.0, 25.0, 1),

    -- Phone Sensors (9) — Issue #528
    (org_id, 'Phone GPS Latitude', 'Smartphone GPS latitude (WGS84)', 'smartphone', '°', -90.0, 90.0, -90.0, 90.0, 6),
    (org_id, 'Phone GPS Longitude', 'Smartphone GPS longitude (WGS84)', 'smartphone', '°', -180.0, 180.0, -180.0, 180.0, 6),
    (org_id, 'Phone Accelerometer', 'Smartphone 3-axis acceleration sensor', 'smartphone', 'm/s²', -20.0, 20.0, -40.0, 40.0, 2),
    (org_id, 'Phone Gyroscope', 'Smartphone 3-axis rotation rate sensor', 'smartphone', '°/s', -500.0, 500.0, -2000.0, 2000.0, 1),
    (org_id, 'Phone Magnetometer', 'Smartphone magnetic field sensor (compass)', 'smartphone', 'µT', -100.0, 100.0, -200.0, 200.0, 1),
    (org_id, 'Phone Barometer', 'Smartphone atmospheric pressure sensor', 'smartphone', 'hPa', 980.0, 1030.0, 950.0, 1050.0, 1),
    (org_id, 'Phone Ambient Light', 'Smartphone light level sensor', 'smartphone', 'lux', 0.0, 1000.0, 0.0, 100000.0, 0),
    (org_id, 'Phone Proximity', 'Smartphone proximity sensor (near/far)', 'smartphone', 'cm', 0.0, 10.0, 0.0, 20.0, 1),
    (org_id, 'Phone Sound Level', 'Smartphone microphone noise monitoring', 'smartphone', 'dBA', 30.0, 85.0, 0.0, 120.0, 1);

  RAISE NOTICE '✅ Created 51 standard device types (incl. 9 phone sensors) for organization %', org_id;
END;
$$;

COMMENT ON FUNCTION seed_organization_device_types IS 'Seeds 51 standard IoT device types (including 9 phone sensor types) for an organization';

-- Backfill: insert the 9 phone sensor device types for ALL existing organizations
-- that don't already have them (idempotent via NOT EXISTS check)
INSERT INTO device_types (organization_id, name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits)
SELECT o.id, v.name, v.description, v.device_class, v.unit, v.lower_normal, v.upper_normal, v.lower_alert, v.upper_alert, v.precision_digits
FROM organizations o
CROSS JOIN (VALUES
  ('Phone GPS Latitude',   'Smartphone GPS latitude (WGS84)',            'smartphone', '°',    -90.0,   90.0,   -90.0,   90.0,   6),
  ('Phone GPS Longitude',  'Smartphone GPS longitude (WGS84)',           'smartphone', '°',    -180.0,  180.0,  -180.0,  180.0,  6),
  ('Phone Accelerometer',  'Smartphone 3-axis acceleration sensor',      'smartphone', 'm/s²', -20.0,   20.0,   -40.0,   40.0,   2),
  ('Phone Gyroscope',      'Smartphone 3-axis rotation rate sensor',     'smartphone', '°/s',  -500.0,  500.0,  -2000.0, 2000.0, 1),
  ('Phone Magnetometer',   'Smartphone magnetic field sensor (compass)', 'smartphone', 'µT',   -100.0,  100.0,  -200.0,  200.0,  1),
  ('Phone Barometer',      'Smartphone atmospheric pressure sensor',     'smartphone', 'hPa',  980.0,   1030.0, 950.0,   1050.0, 1),
  ('Phone Ambient Light',  'Smartphone light level sensor',              'smartphone', 'lux',  0.0,     1000.0, 0.0,     100000.0, 0),
  ('Phone Proximity',      'Smartphone proximity sensor (near/far)',     'smartphone', 'cm',   0.0,     10.0,   0.0,     20.0,   1),
  ('Phone Sound Level',    'Smartphone microphone noise monitoring',     'smartphone', 'dBA',  30.0,    85.0,   0.0,     120.0,  1)
) AS v(name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits)
WHERE NOT EXISTS (
  SELECT 1 FROM device_types dt
  WHERE dt.organization_id = o.id AND dt.name = v.name
);
