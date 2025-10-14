-- Restore proper RLS policy for organization_members
-- Remove the temporary debug policy and restore proper security

DROP POLICY IF EXISTS "temp_debug_allow_all" ON organization_members;

-- Create proper policy for organization members
CREATE POLICY "Users can insert their own memberships"
  ON organization_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'org_admin')
    )
  );

CREATE POLICY "Users can view their own organization memberships"
  ON organization_members FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() 
      AND om.organization_id = organization_members.organization_id
      AND om.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update organization memberships"
  ON organization_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() 
      AND om.organization_id = organization_members.organization_id
      AND om.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can delete organization memberships"
  ON organization_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() 
      AND om.organization_id = organization_members.organization_id
      AND om.role IN ('admin', 'owner')
    )
  );