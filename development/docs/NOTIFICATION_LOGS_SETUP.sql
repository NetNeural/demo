-- ============================================================================
-- SMS Billing & Cost Tracking Setup (Optional)
-- ============================================================================
-- Purpose:
--   Create a notification_logs table to track SMS sends per organization
--   for billing purposes (future feature)
--
-- Note: The SMS infrastructure is already set up. This script is optional
-- if you want to track SMS costs per customer automatically.
--
-- ============================================================================

-- Optional: Create notification_logs table for SMS billing
-- This table can be populated by a Twilio webhook in the future
-- to track SMS sends per organization for automated invoicing

CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
    threshold_id UUID REFERENCES sensor_thresholds(id) ON DELETE SET NULL,
    notification_channel VARCHAR(50) NOT NULL, -- 'sms', 'email', 'slack'
    recipient_phone VARCHAR(20),
    recipient_email VARCHAR(255),
    recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL, -- 'sent', 'delivered', 'failed', 'bounced'
    twilio_message_sid VARCHAR(255), -- For tracking in Twilio's system
    error_message TEXT,
    cost_cents INTEGER, -- Cost in cents (e.g., 1 for $0.01, 75 for $0.75)
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for billing reports
CREATE INDEX IF NOT EXISTS idx_notification_logs_org_channel 
ON notification_logs(organization_id, notification_channel, created_at DESC);

-- Index for SMS billing queries
CREATE INDEX IF NOT EXISTS idx_notification_logs_sms_cost
ON notification_logs(organization_id, created_at DESC)
WHERE notification_channel = 'sms' AND status IN ('sent', 'delivered');

-- ============================================================================
-- Database View: Monthly SMS Costs by Organization (for billing)
-- ============================================================================

CREATE OR REPLACE VIEW sms_billing_summary AS
SELECT 
    o.id as organization_id,
    o.name as organization_name,
    DATE_TRUNC('month', nl.created_at) as billing_month,
    COUNT(*) as sms_count,
    SUM(nl.cost_cents) as total_cost_cents,
    SUM(nl.cost_cents) / 100.0 as total_cost_usd,
    SUM(CASE WHEN nl.status IN ('sent', 'delivered') THEN 1 ELSE 0 END) as successful_sms,
    SUM(CASE WHEN nl.status = 'failed' THEN 1 ELSE 0 END) as failed_sms
FROM organizations o
LEFT JOIN notification_logs nl ON nl.organization_id = o.id 
    AND nl.notification_channel = 'sms'
    AND nl.created_at >= NOW() - INTERVAL '90 days'
GROUP BY o.id, o.name, DATE_TRUNC('month', nl.created_at)
ORDER BY o.name, billing_month DESC;

-- ============================================================================
-- Query: Check SMS costs for a specific organization
-- ============================================================================
-- Uncomment and run to see SMS costs for a customer:

/*
SELECT 
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as sms_sent,
    SUM(cost_cents) / 100.0 as total_cost_usd,
    SUM(CASE WHEN status IN ('sent', 'delivered') THEN 1 ELSE 0 END) as delivered,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM notification_logs
WHERE organization_id = 'your-org-id-here'::uuid
    AND notification_channel = 'sms'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
*/

-- ============================================================================
-- Query: Today's SMS Activity
-- ============================================================================
-- See all SMS sent today:

/*
SELECT 
    o.name as organization,
    DATE(nl.created_at) as date,
    COUNT(*) as sms_count,
    SUM(CASE WHEN nl.status IN ('sent', 'delivered') THEN 1 ELSE 0 END) as delivered,
    SUM(CASE WHEN nl.status = 'failed' THEN 1 ELSE 0 END) as failed,
    SUM(nl.cost_cents) / 100.0 as cost_usd
FROM notification_logs nl
LEFT JOIN organizations o ON o.id = nl.organization_id
WHERE nl.created_at >= NOW() - INTERVAL '1 day'
    AND nl.notification_channel = 'sms'
GROUP BY o.name, DATE(nl.created_at)
ORDER BY DATE(nl.created_at) DESC, o.name;
*/

-- ============================================================================
-- RLS Policies (if using Row-Level Security)
-- ============================================================================
-- Org admins can see their own SMS logs:

/*
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members see own SMS logs"
  ON notification_logs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
*/
