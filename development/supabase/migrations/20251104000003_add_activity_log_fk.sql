-- Add foreign key constraint to device_telemetry_history that references integration_activity_log
-- This migration fixes the ordering issue where the FK was defined before the target table existed

-- First, check if the column exists and add the FK constraint
DO $$ 
BEGIN
  -- Check if activity_log_id column exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'device_telemetry_history' 
    AND column_name = 'activity_log_id'
  ) THEN
    -- Check if FK constraint already exists
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.table_constraints 
      WHERE constraint_name = 'device_telemetry_history_activity_log_id_fkey'
      AND table_name = 'device_telemetry_history'
    ) THEN
      -- Add the FK constraint
      ALTER TABLE device_telemetry_history 
        ADD CONSTRAINT device_telemetry_history_activity_log_id_fkey 
        FOREIGN KEY (activity_log_id) 
        REFERENCES integration_activity_log(id) 
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;
