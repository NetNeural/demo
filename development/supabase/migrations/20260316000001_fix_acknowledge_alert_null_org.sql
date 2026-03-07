-- Fix acknowledge_alert: use alerts.organization_id directly
-- Bug #531: When device_id is NULL (deleted device), the LEFT JOIN returns
-- NULL for d.organization_id. Because SELECT a.*, d.organization_id puts
-- two columns named "organization_id" into the RECORD, the LAST one wins
-- (the device's NULL). This causes the INSERT into alert_acknowledgements
-- to fail with a NOT NULL violation.
--
-- Fix: Use a.organization_id explicitly (alerts always has org_id NOT NULL).

CREATE OR REPLACE FUNCTION public.acknowledge_alert(
  p_alert_id uuid,
  p_user_id uuid,
  p_acknowledgement_type character varying DEFAULT 'acknowledged',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ack_id UUID;
  v_org_id UUID;
  v_alert_title TEXT;
  v_alert_severity TEXT;
BEGIN
  -- Get alert details — use a.organization_id directly (always NOT NULL)
  SELECT a.organization_id, a.title, a.severity::text
  INTO v_org_id, v_alert_title, v_alert_severity
  FROM alerts a
  WHERE a.id = p_alert_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alert not found';
  END IF;

  -- Insert acknowledgement record
  INSERT INTO alert_acknowledgements (
    alert_id,
    user_id,
    organization_id,
    acknowledgement_type,
    notes
  ) VALUES (
    p_alert_id,
    p_user_id,
    v_org_id,
    p_acknowledgement_type,
    p_notes
  )
  RETURNING id INTO v_ack_id;

  -- Always mark alert as resolved when acknowledged
  UPDATE alerts
  SET
    is_resolved = true,
    resolved_by = p_user_id,
    resolved_at = NOW()
  WHERE id = p_alert_id;

  -- Record user action for audit trail
  PERFORM record_user_action(
    p_user_id := p_user_id,
    p_organization_id := v_org_id,
    p_action_type := 'alert_acknowledged',
    p_action_category := 'alert_management',
    p_description := format('Acknowledged alert: %s (%s)', v_alert_title, p_acknowledgement_type),
    p_alert_id := p_alert_id,
    p_metadata := jsonb_build_object(
      'acknowledgement_type', p_acknowledgement_type,
      'alert_severity', v_alert_severity,
      'notes', p_notes
    )
  );

  RETURN v_ack_id;
END;
$$;

COMMENT ON FUNCTION public.acknowledge_alert IS 'Acknowledges an alert and marks it as resolved. Uses alerts.organization_id directly to avoid NULL from deleted devices.';
