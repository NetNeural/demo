-- Migration: Create alert_rules table for Issue #107
-- Enables user-defined alert rules with telemetry and offline detection
-- Date: 2025-12-16

-- Create alert_rules table
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Rule type: 'telemetry' (temp > 35) or 'offline' (no data for 6 hrs)
  rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('telemetry', 'offline')),
  
  -- Condition stored as JSONB
  -- Telemetry: {metric: 'temperature', operator: '>', threshold: 35, duration_minutes: 15, unit: 'celsius'}
  -- Offline: {offline_minutes: 360, grace_period_minutes: 120}
  condition JSONB NOT NULL,
  
  -- Device scope stored as JSONB
  -- {type: 'all'} OR {type: 'groups', group_ids: [...]} OR {type: 'tags', tags: [...]} OR {type: 'specific', ids: [...]}
  device_scope JSONB NOT NULL DEFAULT '{"type": "all"}'::jsonb,
  
  -- Actions stored as JSONB array
  -- [{type: 'email', config: {recipients: [...]}}, {type: 'sms', config: {...}}]
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Cooldown to prevent alert spam (in minutes)
  cooldown_minutes INTEGER NOT NULL DEFAULT 60 CHECK (cooldown_minutes >= 0),
  
  -- Optional schedule restrictions (future feature)
  -- {days: ['mon', 'tue'], start_time: '09:00', end_time: '17:00'}
  schedule_restrictions JSONB,
  
  -- Enable/disable rule
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Track when rule last triggered
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure at least one action is defined
  CONSTRAINT alert_rules_has_actions CHECK (jsonb_array_length(actions) > 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_rules_org ON alert_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON alert_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_last_triggered ON alert_rules(last_triggered_at);
CREATE INDEX IF NOT EXISTS idx_alert_rules_org_enabled ON alert_rules(organization_id, enabled) WHERE enabled = true;

-- Updated_at trigger
CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

-- Users can view rules in their organization
CREATE POLICY alert_rules_select_policy ON alert_rules
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Users with appropriate role can insert rules
CREATE POLICY alert_rules_insert_policy ON alert_rules
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('org_admin', 'org_owner', 'super_admin')
    )
  );

-- Users with appropriate role can update rules
CREATE POLICY alert_rules_update_policy ON alert_rules
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('org_admin', 'org_owner', 'super_admin')
    )
  );

-- Users with appropriate role can delete rules
CREATE POLICY alert_rules_delete_policy ON alert_rules
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('org_admin', 'org_owner', 'super_admin')
    )
  );

-- Update user_actions table to reference alert_rules (if column doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_actions' AND column_name = 'alert_rule_id'
  ) THEN
    ALTER TABLE user_actions 
    ADD COLUMN alert_rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL;
    
    CREATE INDEX idx_user_actions_alert_rule ON user_actions(alert_rule_id);
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE alert_rules IS 'User-defined alert rules for telemetry thresholds and offline detection';
COMMENT ON COLUMN alert_rules.rule_type IS 'Type of rule: telemetry (metric-based) or offline (heartbeat-based)';
COMMENT ON COLUMN alert_rules.condition IS 'JSONB condition definition specific to rule_type';
COMMENT ON COLUMN alert_rules.device_scope IS 'JSONB device scope: all, groups, tags, or specific device IDs';
COMMENT ON COLUMN alert_rules.actions IS 'JSONB array of actions to execute when rule triggers';
COMMENT ON COLUMN alert_rules.cooldown_minutes IS 'Minimum minutes between alert triggers to prevent spam';
