-- Add function to recursively get all descendant organizations
-- This allows admins to see entire org hierarchy including sub-organizations

CREATE OR REPLACE FUNCTION get_all_descendant_organizations(parent_org_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  subscription_tier TEXT,
  is_active BOOLEAN,
  settings JSONB,
  parent_organization_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  depth INTEGER
) 
LANGUAGE SQL
STABLE
AS $$
  WITH RECURSIVE org_tree AS (
    -- Base case: direct children
    SELECT 
      o.id,
      o.name,
      o.slug,
      o.description,
      o.subscription_tier,
      o.is_active,
      o.settings,
      o.parent_organization_id,
      o.created_by,
      o.created_at,
      o.updated_at,
      1 as depth
    FROM organizations o
    WHERE o.parent_organization_id = parent_org_id
    
    UNION ALL
    
    -- Recursive case: children of children
    SELECT 
      o.id,
      o.name,
      o.slug,
      o.description,
      o.subscription_tier,
      o.is_active,
      o.settings,
      o.parent_organization_id,
      o.created_by,
      o.created_at,
      o.updated_at,
      ot.depth + 1
    FROM organizations o
    INNER JOIN org_tree ot ON o.parent_organization_id = ot.id
  )
  SELECT * FROM org_tree
  ORDER BY depth, name;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION get_all_descendant_organizations(UUID) IS 
'Recursively retrieves all descendant organizations of a given parent organization. Returns depth level for each org in the hierarchy.';
