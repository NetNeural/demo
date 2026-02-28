-- #314: Subscription Tier Data Model & Feature Flag System
-- Creates the tier_features table mapping subscription tiers to feature flags.
-- This is the foundation for all tier-dependent feature gating.

-- ============================================================================
-- 1. Create subscription_tier enum type (if not already using one)
--    The organizations.subscription_tier column is VARCHAR(50), so we use TEXT
--    for the tier_features table to stay compatible.
-- ============================================================================

-- 2. Create tier_features table
CREATE TABLE IF NOT EXISTS tier_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier TEXT NOT NULL,
    feature_key TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (tier, feature_key)
);

-- Index for fast lookups by tier
CREATE INDEX IF NOT EXISTS idx_tier_features_tier ON tier_features(tier);
CREATE INDEX IF NOT EXISTS idx_tier_features_feature_key ON tier_features(feature_key);

-- 3. Enable RLS
ALTER TABLE tier_features ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Everyone can read tier features (needed for UI gating)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Anyone can read tier features" ON tier_features;
    CREATE POLICY "Anyone can read tier features" ON tier_features
        FOR SELECT USING (true);

    -- Only super_admins can modify tier features
    DROP POLICY IF EXISTS "Super admins can manage tier features" ON tier_features;
    CREATE POLICY "Super admins can manage tier features" ON tier_features
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = auth.uid()
                AND u.role = 'super_admin'
            )
        );
END $$;

-- 5. PostgreSQL function: get_tier_features(tier_name)
-- Returns all enabled feature keys for a given tier
CREATE OR REPLACE FUNCTION get_tier_features(tier_name TEXT)
RETURNS TABLE(feature_key TEXT, enabled BOOLEAN, description TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT tf.feature_key, tf.enabled, tf.description
    FROM tier_features tf
    WHERE tf.tier = tier_name;
END;
$$;

-- 6. PostgreSQL function: get_org_features(org_id)
-- Returns all enabled feature keys for an organization based on its subscription tier
CREATE OR REPLACE FUNCTION get_org_features(org_id UUID)
RETURNS TABLE(feature_key TEXT, enabled BOOLEAN, description TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    org_tier TEXT;
BEGIN
    SELECT o.subscription_tier INTO org_tier
    FROM organizations o
    WHERE o.id = org_id;

    IF org_tier IS NULL THEN
        org_tier := 'starter';
    END IF;

    RETURN QUERY
    SELECT tf.feature_key, tf.enabled, tf.description
    FROM tier_features tf
    WHERE tf.tier = org_tier;
END;
$$;

-- 7. PostgreSQL function: org_has_feature(org_id, feature)
-- Quick boolean check if an org has a specific feature enabled
CREATE OR REPLACE FUNCTION org_has_feature(org_id UUID, feature TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    org_tier TEXT;
    is_enabled BOOLEAN;
BEGIN
    SELECT o.subscription_tier INTO org_tier
    FROM organizations o
    WHERE o.id = org_id;

    IF org_tier IS NULL THEN
        org_tier := 'starter';
    END IF;

    SELECT tf.enabled INTO is_enabled
    FROM tier_features tf
    WHERE tf.tier = org_tier AND tf.feature_key = feature;

    RETURN COALESCE(is_enabled, false);
END;
$$;

-- 8. Seed default feature mappings for all tiers
-- ============================================================================
-- Feature key reference:
--   device_monitoring       - Basic device status & telemetry
--   alert_notifications     - Email/SMS/webhook alert notifications
--   dashboard_analytics     - Dashboard with charts & analytics
--   data_export             - Export data to CSV/PDF
--   custom_branding         - Custom org logo, colors, login page
--   api_access              - REST API access for integrations
--   ai_detection            - AI-powered anomaly detection
--   predictive_ai           - Predictive maintenance AI
--   fleet_analytics         - Fleet-wide analytics & comparisons
--   advanced_alerts         - Complex alert rules, escalation chains
--   sso                     - SAML/OIDC Single Sign-On
--   audit_logs              - Full audit trail
--   data_retention_extended - Extended data retention (1yr+)
--   multi_location          - Multiple locations per org
--   firmware_management     - OTA firmware updates
--   priority_support        - Priority support SLA
--   unlimited_users         - No user seat limit
--   custom_integrations     - Custom webhook/API integrations
--   white_label             - Full white-label capabilities
--   dedicated_infra         - Dedicated infrastructure/SLA
-- ============================================================================

INSERT INTO tier_features (tier, feature_key, enabled, description) VALUES
    -- ========== STARTER TIER ==========
    ('starter', 'device_monitoring',       true,  'Basic device status and telemetry monitoring'),
    ('starter', 'alert_notifications',     true,  'Email alert notifications'),
    ('starter', 'dashboard_analytics',     true,  'Basic dashboard with charts'),
    ('starter', 'data_export',             false, 'Export data to CSV/PDF'),
    ('starter', 'custom_branding',         false, 'Custom organization branding'),
    ('starter', 'api_access',              false, 'REST API access'),
    ('starter', 'ai_detection',            false, 'AI anomaly detection'),
    ('starter', 'predictive_ai',           false, 'Predictive maintenance AI'),
    ('starter', 'fleet_analytics',         false, 'Fleet-wide analytics'),
    ('starter', 'advanced_alerts',         false, 'Advanced alert rules & escalations'),
    ('starter', 'sso',                     false, 'SAML/OIDC Single Sign-On'),
    ('starter', 'audit_logs',              false, 'Audit trail logging'),
    ('starter', 'data_retention_extended', false, 'Extended data retention (1yr+)'),
    ('starter', 'multi_location',          false, 'Multiple locations per org'),
    ('starter', 'firmware_management',     false, 'OTA firmware management'),
    ('starter', 'priority_support',        false, 'Priority support SLA'),
    ('starter', 'unlimited_users',         false, 'Unlimited user seats'),
    ('starter', 'custom_integrations',     false, 'Custom webhook/API integrations'),
    ('starter', 'white_label',             false, 'White-label capabilities'),
    ('starter', 'dedicated_infra',         false, 'Dedicated infrastructure'),

    -- ========== PROFESSIONAL TIER ==========
    ('professional', 'device_monitoring',       true,  'Basic device status and telemetry monitoring'),
    ('professional', 'alert_notifications',     true,  'Email, SMS, and webhook alert notifications'),
    ('professional', 'dashboard_analytics',     true,  'Full dashboard with advanced charts'),
    ('professional', 'data_export',             true,  'Export data to CSV/PDF'),
    ('professional', 'custom_branding',         true,  'Custom organization branding'),
    ('professional', 'api_access',              true,  'REST API access'),
    ('professional', 'ai_detection',            true,  'AI anomaly detection'),
    ('professional', 'predictive_ai',           false, 'Predictive maintenance AI'),
    ('professional', 'fleet_analytics',         true,  'Fleet-wide analytics'),
    ('professional', 'advanced_alerts',         true,  'Advanced alert rules & escalations'),
    ('professional', 'sso',                     false, 'SAML/OIDC Single Sign-On'),
    ('professional', 'audit_logs',              true,  'Audit trail logging'),
    ('professional', 'data_retention_extended', true,  'Extended data retention (1yr+)'),
    ('professional', 'multi_location',          true,  'Multiple locations per org'),
    ('professional', 'firmware_management',     true,  'OTA firmware management'),
    ('professional', 'priority_support',        false, 'Priority support SLA'),
    ('professional', 'unlimited_users',         false, 'Unlimited user seats'),
    ('professional', 'custom_integrations',     true,  'Custom webhook/API integrations'),
    ('professional', 'white_label',             false, 'White-label capabilities'),
    ('professional', 'dedicated_infra',         false, 'Dedicated infrastructure'),

    -- ========== ENTERPRISE TIER ==========
    ('enterprise', 'device_monitoring',       true,  'Basic device status and telemetry monitoring'),
    ('enterprise', 'alert_notifications',     true,  'All notification channels with escalation'),
    ('enterprise', 'dashboard_analytics',     true,  'Full dashboard with custom widgets'),
    ('enterprise', 'data_export',             true,  'Export data to CSV/PDF with scheduling'),
    ('enterprise', 'custom_branding',         true,  'Full custom branding including login page'),
    ('enterprise', 'api_access',              true,  'Full REST API access with higher rate limits'),
    ('enterprise', 'ai_detection',            true,  'AI anomaly detection with custom models'),
    ('enterprise', 'predictive_ai',           true,  'Predictive maintenance AI'),
    ('enterprise', 'fleet_analytics',         true,  'Fleet-wide analytics with comparisons'),
    ('enterprise', 'advanced_alerts',         true,  'Advanced alert rules, escalation, & auto-remediation'),
    ('enterprise', 'sso',                     true,  'SAML/OIDC Single Sign-On'),
    ('enterprise', 'audit_logs',              true,  'Full audit trail with export'),
    ('enterprise', 'data_retention_extended', true,  'Extended data retention (unlimited)'),
    ('enterprise', 'multi_location',          true,  'Unlimited locations per org'),
    ('enterprise', 'firmware_management',     true,  'OTA firmware management with rollback'),
    ('enterprise', 'priority_support',        true,  'Priority support with dedicated CSM'),
    ('enterprise', 'unlimited_users',         true,  'Unlimited user seats'),
    ('enterprise', 'custom_integrations',     true,  'Custom webhook/API integrations'),
    ('enterprise', 'white_label',             true,  'Full white-label capabilities'),
    ('enterprise', 'dedicated_infra',         true,  'Dedicated infrastructure & SLA')

ON CONFLICT (tier, feature_key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    description = EXCLUDED.description,
    updated_at = NOW();
