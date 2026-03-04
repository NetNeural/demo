-- ============================================================================
-- Migration: Fix V-Mark MQTT Device-Integration Linkage
-- ============================================================================
-- Problem: Devices moved between orgs still have integration_id pointing to
-- the source org's integration. MQTT credentials also need re-pointing so
-- the hub authenticates against the correct org.
--
-- Fix: Single cohesive block that re-links devices AND re-points their MQTT
-- credentials in the same pass, keeping old/new integration IDs consistent.
-- ============================================================================

-- Ensure pgcrypto is available (used by generate_mqtt_credentials fallback)
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

DO $$
DECLARE
  v_device RECORD;
  v_target_integration_id UUID;
  v_fixed_count INTEGER := 0;
  v_cred_count INTEGER := 0;
  v_cred RECORD;
  v_new_topic_prefix TEXT;
BEGIN
  RAISE NOTICE '=== Cross-Org Device + MQTT Credential Fix ===';

  -- Find devices whose integration_id points to an integration in a DIFFERENT org
  FOR v_device IN
    SELECT
      d.id AS device_id,
      d.name AS device_name,
      d.organization_id AS device_org_id,
      d.integration_id AS old_integration_id,
      di.organization_id AS old_integration_org_id,
      di.integration_type
    FROM devices d
    JOIN device_integrations di ON d.integration_id = di.id
    WHERE d.organization_id != di.organization_id
  LOOP
    -- Find a matching integration in the device's ACTUAL org (same type)
    SELECT id INTO v_target_integration_id
    FROM device_integrations
    WHERE organization_id = v_device.device_org_id
      AND integration_type = v_device.integration_type
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_target_integration_id IS NOT NULL THEN
      -- Update device to point to the correct integration
      UPDATE devices
      SET integration_id = v_target_integration_id,
          updated_at = now()
      WHERE id = v_device.device_id;

      v_fixed_count := v_fixed_count + 1;

      RAISE NOTICE 'Fixed device "%" (%) - relinked from integration % (org %) to % (org %)',
        v_device.device_name, v_device.device_id,
        v_device.old_integration_id, v_device.old_integration_org_id,
        v_target_integration_id, v_device.device_org_id;

      -- Now re-point any MQTT credentials from the OLD integration to the NEW one.
      -- This preserves username/password/client_id so the physical hub needs no changes.
      v_new_topic_prefix := 'org_' || substring(v_device.device_org_id::text from 1 for 8) || '/';

      FOR v_cred IN
        SELECT * FROM mqtt_credentials
        WHERE integration_id = v_device.old_integration_id
          AND organization_id = v_device.old_integration_org_id
      LOOP
        -- Check if target org+integration already has MQTT creds (unique constraint)
        IF NOT EXISTS (
          SELECT 1 FROM mqtt_credentials
          WHERE organization_id = v_device.device_org_id
            AND integration_id = v_target_integration_id
        ) THEN
          UPDATE mqtt_credentials
          SET
            organization_id = v_device.device_org_id,
            integration_id = v_target_integration_id,
            topic_prefix = v_new_topic_prefix,
            allowed_topics = ARRAY[v_new_topic_prefix || 'devices/#', v_new_topic_prefix || 'commands/#'],
            updated_at = now()
          WHERE id = v_cred.id;

          v_cred_count := v_cred_count + 1;

          RAISE NOTICE 'Re-pointed MQTT creds % (user: %) from org % to org % (integration %)',
            v_cred.id, v_cred.username,
            v_cred.organization_id,
            v_device.device_org_id, v_target_integration_id;
        ELSE
          RAISE NOTICE 'MQTT creds already exist for org % + integration % — skipping re-point of %',
            v_device.device_org_id, v_target_integration_id, v_cred.id;
        END IF;
      END LOOP;

    ELSE
      RAISE WARNING 'Device "%" (%) has no matching % integration in org % - skipped',
        v_device.device_name, v_device.device_id,
        v_device.integration_type, v_device.device_org_id;
    END IF;
  END LOOP;

  RAISE NOTICE 'Summary: relinked % device(s), re-pointed % MQTT credential set(s)', v_fixed_count, v_cred_count;
END $$;
