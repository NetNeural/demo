-- Migration: Alert Acknowledgements and User Action Tracking
-- Description: Add tables for tracking alert acknowledgements and user actions for analytics
-- Date: 2025-01-10

-- =====================================================
-- ALERT ACKNOWLEDGEMENTS
-- =====================================================
-- Track when users acknowledge/dismiss alerts
-- Used for: Alert management, user experience, analytics

CREATE TABLE IF NOT EXISTS alert_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Acknowledgement details
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledgement_type VARCHAR(50) NOT NULL DEFAULT 'acknowledged',
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_acknowledgement_type CHECK (
    acknowledgement_type IN ('acknowledged', 'dismissed', 'resolved', 'false_positive')
  )
);

-- Indexes for performance
CREATE INDEX idx_alert_acks_alert_id ON alert_acknowledgements(alert_id);
CREATE INDEX idx_alert_acks_user_id ON alert_acknowledgements(user_id);
CREATE INDEX idx_alert_acks_org_id ON alert_acknowledgements(organization_id);
CREATE INDEX idx_alert_acks_acknowledged_at ON alert_acknowledgements(acknowledged_at DESC);

-- RLS Policies
ALTER TABLE alert_acknowledgements ENABLE ROW LEVEL SECURITY;

-- Users can view acknowledgements in their organization
CREATE POLICY "Users can view alert acknowledgements in their org"
  ON alert_acknowledgements FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can create acknowledgements for alerts in their organization
CREATE POLICY "Users can create alert acknowledgements"
  ON alert_acknowledgements FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- =====================================================
-- USER ACTIONS
-- =====================================================
-- Track all user interactions for analytics and audit trail
-- Used for: Analytics, compliance, debugging, user behavior insights

CREATE TABLE IF NOT EXISTS user_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Action details
  action_type VARCHAR(100) NOT NULL,
  action_category VARCHAR(50) NOT NULL,
  description TEXT,
  
  -- Related entities (nullable - depends on action type)
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  integration_id UUID REFERENCES device_integrations(id) ON DELETE SET NULL,
  alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
  alert_rule_id UUID,  -- FK to alert_rules removed - table doesn't exist yet
  
  -- Action metadata (flexible JSON for action-specific data)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Result tracking
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  
  -- Request context
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_action_category CHECK (
    action_category IN (
      'device_management',
      'integration_management',
      'alert_management',
      'sync_operation',
      'configuration',
      'authentication',
      'analytics_view',
      'other'
    )
  )
);

-- Indexes for performance and analytics queries
CREATE INDEX idx_user_actions_user_id ON user_actions(user_id);
CREATE INDEX idx_user_actions_org_id ON user_actions(organization_id);
CREATE INDEX idx_user_actions_action_type ON user_actions(action_type);
CREATE INDEX idx_user_actions_action_category ON user_actions(action_category);
CREATE INDEX idx_user_actions_device_id ON user_actions(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX idx_user_actions_integration_id ON user_actions(integration_id) WHERE integration_id IS NOT NULL;
CREATE INDEX idx_user_actions_alert_id ON user_actions(alert_id) WHERE alert_id IS NOT NULL;
CREATE INDEX idx_user_actions_created_at ON user_actions(created_at DESC);
CREATE INDEX idx_user_actions_metadata ON user_actions USING GIN(metadata);

-- RLS Policies
ALTER TABLE user_actions ENABLE ROW LEVEL SECURITY;

-- Users can view actions in their organization
CREATE POLICY "Users can view user actions in their org"
  ON user_actions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can insert their own actions
CREATE POLICY "Users can create their own actions"
  ON user_actions FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to record user action
CREATE OR REPLACE FUNCTION record_user_action(
  p_user_id UUID,
  p_organization_id UUID,
  p_action_type VARCHAR,
  p_action_category VARCHAR,
  p_description TEXT DEFAULT NULL,
  p_device_id UUID DEFAULT NULL,
  p_integration_id UUID DEFAULT NULL,
  p_alert_id UUID DEFAULT NULL,
  p_alert_rule_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_action_id UUID;
BEGIN
  INSERT INTO user_actions (
    user_id,
    organization_id,
    action_type,
    action_category,
    description,
    device_id,
    integration_id,
    alert_id,
    alert_rule_id,
    metadata,
    success,
    error_message
  ) VALUES (
    p_user_id,
    p_organization_id,
    p_action_type,
    p_action_category,
    p_description,
    p_device_id,
    p_integration_id,
    p_alert_id,
    p_alert_rule_id,
    p_metadata,
    p_success,
    p_error_message
  )
  RETURNING id INTO v_action_id;
  
  RETURN v_action_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to acknowledge alert
CREATE OR REPLACE FUNCTION acknowledge_alert(
  p_alert_id UUID,
  p_user_id UUID,
  p_acknowledgement_type VARCHAR DEFAULT 'acknowledged',
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_ack_id UUID;
  v_org_id UUID;
  v_alert_record RECORD;
BEGIN
  -- Get alert details
  SELECT a.*, d.organization_id
  INTO v_alert_record
  FROM alerts a
  JOIN devices d ON d.id = a.device_id
  WHERE a.id = p_alert_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alert not found';
  END IF;
  
  v_org_id := v_alert_record.organization_id;
  
  -- Insert acknowledgement
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
  
  -- Update alert status based on acknowledgement type
  IF p_acknowledgement_type = 'resolved' THEN
    UPDATE alerts
    SET status = 'resolved',
        resolved_at = NOW()
    WHERE id = p_alert_id;
  ELSIF p_acknowledgement_type = 'dismissed' THEN
    UPDATE alerts
    SET status = 'dismissed'
    WHERE id = p_alert_id;
  END IF;
  
  -- Record user action
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ANALYTICS VIEWS
-- =====================================================

-- View: Alert acknowledgement statistics
CREATE OR REPLACE VIEW alert_acknowledgement_stats AS
SELECT
  a.organization_id,
  a.severity,
  COUNT(DISTINCT a.id) as total_alerts,
  COUNT(DISTINCT aa.id) as acknowledged_alerts,
  COUNT(DISTINCT CASE WHEN aa.acknowledgement_type = 'resolved' THEN aa.id END) as resolved_alerts,
  COUNT(DISTINCT CASE WHEN aa.acknowledgement_type = 'dismissed' THEN aa.id END) as dismissed_alerts,
  COUNT(DISTINCT CASE WHEN aa.acknowledgement_type = 'false_positive' THEN aa.id END) as false_positive_alerts,
  AVG(EXTRACT(EPOCH FROM (aa.acknowledged_at - a.created_at))) as avg_acknowledgement_time_seconds,
  DATE_TRUNC('day', a.created_at) as date
FROM alerts a
LEFT JOIN alert_acknowledgements aa ON aa.alert_id = a.id
GROUP BY a.organization_id, a.severity, DATE_TRUNC('day', a.created_at);

-- View: User action summary
CREATE OR REPLACE VIEW user_action_summary AS
SELECT
  ua.user_id,
  ua.organization_id,
  ua.action_category,
  COUNT(*) as action_count,
  COUNT(*) FILTER (WHERE ua.success = true) as successful_actions,
  COUNT(*) FILTER (WHERE ua.success = false) as failed_actions,
  DATE_TRUNC('day', ua.created_at) as date
FROM user_actions ua
GROUP BY ua.user_id, ua.organization_id, ua.action_category, DATE_TRUNC('day', ua.created_at);

-- View: Device action history (for device detail pages)
CREATE OR REPLACE VIEW device_action_history AS
SELECT
  ua.device_id,
  ua.user_id,
  u.email as user_email,
  ua.action_type,
  ua.action_category,
  ua.description,
  ua.metadata,
  ua.success,
  ua.created_at
FROM user_actions ua
LEFT JOIN auth.users u ON u.id = ua.user_id
WHERE ua.device_id IS NOT NULL
ORDER BY ua.created_at DESC;

-- =====================================================
-- DATA RETENTION
-- =====================================================

-- Function to cleanup old user actions (keep 1 year)
CREATE OR REPLACE FUNCTION cleanup_old_user_actions(p_days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM user_actions
  WHERE created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL
    AND action_category != 'alert_management'; -- Keep alert actions indefinitely
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE alert_acknowledgements IS 'Tracks when users acknowledge or dismiss alerts';
COMMENT ON TABLE user_actions IS 'Audit log of all user interactions for analytics and compliance';
COMMENT ON FUNCTION record_user_action IS 'Helper function to record user actions consistently';
COMMENT ON FUNCTION acknowledge_alert IS 'Acknowledge an alert and update its status';
COMMENT ON VIEW alert_acknowledgement_stats IS 'Statistics on alert acknowledgements for analytics';
COMMENT ON VIEW user_action_summary IS 'Summary of user actions by category and date';
COMMENT ON VIEW device_action_history IS 'Action history for specific devices';
