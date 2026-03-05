-- Add platform_owner tier and apply to NetNeural organization
-- platform_owner is the top-tier: above reseller/enterprise.
-- It represents the organization that owns and operates the platform.

-- 1. Update NetNeural's subscription_tier to platform_owner
UPDATE organizations
SET subscription_tier = 'platform_owner',
    is_reseller = true,
    updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 2. Insert platform_owner tier features (all enabled)
INSERT INTO tier_features (tier, feature_key, enabled, description)
SELECT 'platform_owner', feature_key, true, description
FROM tier_features
WHERE tier = 'unlimited'
ON CONFLICT (tier, feature_key) DO NOTHING;
