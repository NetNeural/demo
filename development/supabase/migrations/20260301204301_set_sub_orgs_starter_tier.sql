-- Set all sub-organizations to 'starter' tier unless they already have 'professional' or 'enterprise'
UPDATE organizations
SET subscription_tier = 'starter'
WHERE parent_organization_id IS NOT NULL
  AND (subscription_tier IS NULL OR subscription_tier NOT IN ('professional', 'enterprise'));
