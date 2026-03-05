-- Fix #441: Add "Human Presence" to standard device types
-- Backfills existing orgs and updates the seed function for new orgs

-- 1. Backfill: insert Human Presence for all existing orgs that don't have it
INSERT INTO device_types (organization_id, name, description, device_class, unit, lower_normal, upper_normal, lower_alert, upper_alert, precision_digits)
SELECT o.id, 'Human Presence', 'mmWave radar or IR-based human presence detection', 'other', 'boolean', 0.0, 1.0, 0.0, 1.0, 0
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM device_types dt
  WHERE dt.organization_id = o.id AND dt.name = 'Human Presence'
);

-- 2. Update the seed function to include Human Presence (43 types total)
-- Uses dynamic SQL to patch the function body, adding Human Presence after People Count
DO $$
DECLARE
  func_src text;
  new_func text;
BEGIN
  -- Get current function source
  SELECT prosrc INTO func_src FROM pg_proc WHERE proname = 'seed_organization_device_types';

  -- Add Human Presence row after People Count row
  func_src := replace(
    func_src,
    E'(org_id, \'People Count\', \'IR/camera-based occupancy counting\', \'other\', \'count\', 0.0, 50.0, 0.0, 100.0, 0),',
    E'(org_id, \'People Count\', \'IR/camera-based occupancy counting\', \'other\', \'count\', 0.0, 50.0, 0.0, 100.0, 0),\n    (org_id, \'Human Presence\', \'mmWave radar or IR-based human presence detection\', \'other\', \'boolean\', 0.0, 1.0, 0.0, 1.0, 0),'
  );

  -- Rebuild the function with updated body
  new_func := format(
    'CREATE OR REPLACE FUNCTION public.seed_organization_device_types(org_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $func$ %s $func$',
    func_src
  );

  EXECUTE new_func;
END $$;
