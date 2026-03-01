-- Fix remaining MQTT Device 0AB259CFD0400002 identifiers
-- This device was missed because its integration_id changed
-- from 4cb3e31e to a6d0e905 in a prior migration

UPDATE devices
SET serial_number = COALESCE(serial_number, '0AB259CFD0400002'),
    external_device_id = COALESCE(external_device_id, '0AB259CFD0400002'),
    updated_at = NOW()
WHERE id = '459c7cf2-546e-4fe4-9617-63ec40242873'
  AND (serial_number IS NULL OR external_device_id IS NULL);
