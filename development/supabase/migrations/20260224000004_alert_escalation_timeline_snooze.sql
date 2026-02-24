-- Migration: Alert Escalation, Timeline, Snooze, Statistics
-- Features: escalation rules, event timeline, snooze, enhanced stats
-- Date: 2026-02-24

-- ═══════════════════════════════════════════════════════════════
-- 1. ALERT EVENTS TABLE (Timeline)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'notified', 'viewed', 'acknowledged', 'resolved',
    'snoozed', 'unsnoozed', 'escalated', 'comment'
  )),
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_events_alert_id ON alert_events(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_created_at ON alert_events(created_at DESC);

ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_role_alert_events" ON alert_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can view events for alerts in their org
CREATE POLICY "users_view_alert_events" ON alert_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM alerts a
    JOIN organization_members om ON om.organization_id = a.organization_id
    WHERE a.id = alert_events.alert_id AND om.user_id = auth.uid()
  ));

-- ═══════════════════════════════════════════════════════════════
-- 2. ALERT ESCALATION RULES TABLE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS alert_escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  escalation_delay_minutes INTEGER NOT NULL DEFAULT 30,
  escalate_to_user_ids UUID[] DEFAULT '{}',
  escalate_to_emails TEXT[] DEFAULT '{}',
  notification_channels TEXT[] DEFAULT ARRAY['email'],
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, severity)
);

CREATE INDEX IF NOT EXISTS idx_escalation_rules_org ON alert_escalation_rules(organization_id);

ALTER TABLE alert_escalation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_escalation_rules" ON alert_escalation_rules FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "users_view_escalation_rules" ON alert_escalation_rules FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = alert_escalation_rules.organization_id
    AND om.user_id = auth.uid()
  ));

CREATE POLICY "admins_manage_escalation_rules" ON alert_escalation_rules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = alert_escalation_rules.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  ));

-- ═══════════════════════════════════════════════════════════════
-- 3. SNOOZE COLUMNS ON ALERTS TABLE
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS snoozed_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_alerts_snoozed ON alerts(snoozed_until)
  WHERE snoozed_until IS NOT NULL AND is_resolved = false;

-- ═══════════════════════════════════════════════════════════════
-- 4. ALERT STATISTICS VIEW (materialized for performance)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW alert_statistics AS
SELECT
  a.organization_id,
  COUNT(*) AS total_alerts,
  COUNT(*) FILTER (WHERE NOT a.is_resolved) AS active_alerts,
  COUNT(*) FILTER (WHERE a.is_resolved) AS resolved_alerts,
  COUNT(*) FILTER (WHERE a.severity = 'critical' AND NOT a.is_resolved) AS active_critical,
  COUNT(*) FILTER (WHERE a.severity = 'high' AND NOT a.is_resolved) AS active_high,
  COUNT(*) FILTER (WHERE a.snoozed_until IS NOT NULL AND a.snoozed_until > now() AND NOT a.is_resolved) AS snoozed_alerts,
  -- Mean time to resolve (in minutes) for resolved alerts in last 30 days
  ROUND(AVG(
    EXTRACT(EPOCH FROM (a.resolved_at - a.created_at)) / 60.0
  ) FILTER (WHERE a.is_resolved AND a.resolved_at IS NOT NULL AND a.created_at > now() - interval '30 days'), 1)
    AS mttr_minutes,
  -- Fastest resolution (minutes)
  ROUND(MIN(
    EXTRACT(EPOCH FROM (a.resolved_at - a.created_at)) / 60.0
  ) FILTER (WHERE a.is_resolved AND a.resolved_at IS NOT NULL AND a.created_at > now() - interval '30 days'), 1)
    AS fastest_resolution_minutes,
  -- Alerts in last 24h
  COUNT(*) FILTER (WHERE a.created_at > now() - interval '24 hours') AS alerts_last_24h,
  -- Alerts in last 7 days
  COUNT(*) FILTER (WHERE a.created_at > now() - interval '7 days') AS alerts_last_7d
FROM alerts a
GROUP BY a.organization_id;

-- Top alerting devices view
CREATE OR REPLACE VIEW alert_device_rankings AS
SELECT
  a.organization_id,
  a.device_id,
  d.name AS device_name,
  COUNT(*) AS alert_count,
  COUNT(*) FILTER (WHERE NOT a.is_resolved) AS active_count,
  COUNT(*) FILTER (WHERE a.severity = 'critical') AS critical_count,
  MAX(a.created_at) AS last_alert_at
FROM alerts a
LEFT JOIN devices d ON d.id = a.device_id
WHERE a.created_at > now() - interval '30 days'
GROUP BY a.organization_id, a.device_id, d.name
ORDER BY alert_count DESC;

-- ═══════════════════════════════════════════════════════════════
-- 5. TRIGGERS FOR AUTOMATIC TIMELINE EVENTS
-- ═══════════════════════════════════════════════════════════════

-- Record 'created' event on new alert
CREATE OR REPLACE FUNCTION record_alert_created_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO alert_events (alert_id, event_type, metadata)
  VALUES (NEW.id, 'created', jsonb_build_object(
    'severity', NEW.severity,
    'category', COALESCE(NEW.category, 'system'),
    'device_id', NEW.device_id,
    'title', NEW.title
  ));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_alert_created_event ON alerts;
CREATE TRIGGER trg_alert_created_event
  AFTER INSERT ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION record_alert_created_event();

-- Record 'resolved' event when alert is resolved
CREATE OR REPLACE FUNCTION record_alert_resolved_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_resolved IS TRUE AND (OLD.is_resolved IS FALSE OR OLD.is_resolved IS NULL) THEN
    INSERT INTO alert_events (alert_id, event_type, user_id, metadata)
    VALUES (NEW.id, 'resolved', NEW.resolved_by, jsonb_build_object(
      'resolved_at', NEW.resolved_at
    ));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_alert_resolved_event ON alerts;
CREATE TRIGGER trg_alert_resolved_event
  AFTER UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION record_alert_resolved_event();

-- Record 'snoozed' event when alert is snoozed
CREATE OR REPLACE FUNCTION record_alert_snoozed_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.snoozed_until IS NOT NULL AND (OLD.snoozed_until IS NULL OR NEW.snoozed_until <> OLD.snoozed_until) THEN
    INSERT INTO alert_events (alert_id, event_type, user_id, metadata)
    VALUES (NEW.id, 'snoozed', NEW.snoozed_by, jsonb_build_object(
      'snoozed_until', NEW.snoozed_until
    ));
  END IF;
  -- Record 'unsnoozed' if snooze was cleared manually
  IF NEW.snoozed_until IS NULL AND OLD.snoozed_until IS NOT NULL THEN
    INSERT INTO alert_events (alert_id, event_type, user_id, metadata)
    VALUES (NEW.id, 'unsnoozed', NEW.snoozed_by, '{}');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_alert_snoozed_event ON alerts;
CREATE TRIGGER trg_alert_snoozed_event
  AFTER UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION record_alert_snoozed_event();

-- ═══════════════════════════════════════════════════════════════
-- 6. DEFAULT ESCALATION RULES FOR EXISTING ORGS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO alert_escalation_rules (organization_id, severity, escalation_delay_minutes, enabled)
SELECT id, 'critical', 15, true FROM organizations
ON CONFLICT (organization_id, severity) DO NOTHING;

INSERT INTO alert_escalation_rules (organization_id, severity, escalation_delay_minutes, enabled)
SELECT id, 'high', 30, true FROM organizations
ON CONFLICT (organization_id, severity) DO NOTHING;

INSERT INTO alert_escalation_rules (organization_id, severity, escalation_delay_minutes, enabled)
SELECT id, 'medium', 60, false FROM organizations
ON CONFLICT (organization_id, severity) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 7. BACKFILL TIMELINE EVENTS FOR EXISTING ALERTS
-- ═══════════════════════════════════════════════════════════════

-- Insert 'created' events for all existing alerts
INSERT INTO alert_events (alert_id, event_type, metadata, created_at)
SELECT
  id,
  'created',
  jsonb_build_object('severity', severity, 'category', COALESCE(category, 'system'), 'device_id', device_id, 'title', title, 'backfilled', true),
  created_at
FROM alerts
WHERE NOT EXISTS (
  SELECT 1 FROM alert_events ae WHERE ae.alert_id = alerts.id AND ae.event_type = 'created'
);

-- Insert 'resolved' events for resolved alerts
INSERT INTO alert_events (alert_id, event_type, user_id, metadata, created_at)
SELECT
  id,
  'resolved',
  resolved_by,
  jsonb_build_object('resolved_at', resolved_at, 'backfilled', true),
  COALESCE(resolved_at, created_at + interval '1 second')
FROM alerts
WHERE is_resolved = true
AND NOT EXISTS (
  SELECT 1 FROM alert_events ae WHERE ae.alert_id = alerts.id AND ae.event_type = 'resolved'
);
