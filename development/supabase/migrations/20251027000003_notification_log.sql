-- ============================================================================
-- NOTIFICATION LOG TABLE
-- ============================================================================
-- Tracks all notifications sent via Email, Slack, Webhooks
-- Provides audit trail and delivery status
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES device_integrations(id) ON DELETE CASCADE,
    integration_type VARCHAR(50) NOT NULL CHECK (integration_type IN ('email', 'slack', 'webhook')),
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
    sent_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notification_log_org ON notification_log(organization_id, created_at DESC);
CREATE INDEX idx_notification_log_integration ON notification_log(integration_id);
CREATE INDEX idx_notification_log_status ON notification_log(status) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_notification_log_type ON notification_log(integration_type, status);

-- RLS
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_view_notifications" ON notification_log
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "system_manage_notifications" ON notification_log
    FOR ALL USING (true);

-- Trigger
CREATE TRIGGER update_notification_log_updated_at
    BEFORE UPDATE ON notification_log
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE notification_log IS 'Audit trail for all notifications sent via Email, Slack, and Webhooks';
