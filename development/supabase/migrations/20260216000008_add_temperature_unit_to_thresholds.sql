-- Add temperature_unit column to sensor_thresholds
-- Allows users to specify Celsius or Fahrenheit for temperature thresholds

ALTER TABLE sensor_thresholds 
ADD COLUMN IF NOT EXISTS temperature_unit VARCHAR(20) DEFAULT 'celsius';

-- Add check constraint for valid units
ALTER TABLE sensor_thresholds
ADD CONSTRAINT temperature_unit_check 
CHECK (temperature_unit IN ('celsius', 'fahrenheit'));

COMMENT ON COLUMN sensor_thresholds.temperature_unit IS 
  'Temperature unit for threshold values (celsius or fahrenheit). Only applies to temperature-related sensors.';
