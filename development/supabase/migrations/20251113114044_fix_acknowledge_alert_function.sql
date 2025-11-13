-- Fix acknowledge_alert function to properly set is_resolved flag
-- This ensures acknowledged alerts are filtered out when fetching active alerts

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
  v_alert_record RECORD;
BEGIN
  -- Get alert details
  SELECT a.*, d.organization_id
  INTO v_alert_record
  FROM alerts a
  LEFT JOIN devices d ON d.id = a.device_id
  WHERE a.id = p_alert_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alert not found';
  END IF;

  v_org_id := v_alert_record.organization_id;

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
  -- This ensures the alert is filtered out from active alerts list
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
    p_description := format('Acknowledged alert: %s (%s)', v_alert_record.title, p_acknowledgement_type),
    p_alert_id := p_alert_id,
    p_metadata := jsonb_build_object(
      'acknowledgement_type', p_acknowledgement_type,
      'alert_severity', v_alert_record.severity,
      'notes', p_notes
    )
  );

  RETURN v_ack_id;
END;
$$;

COMMENT ON FUNCTION public.acknowledge_alert IS 
  'Acknowledges an alert and marks it as resolved. ' ||
  'Sets is_resolved=true, resolved_by, and resolved_at fields. ' ||
  'Creates an acknowledgement record and logs the user action.';
