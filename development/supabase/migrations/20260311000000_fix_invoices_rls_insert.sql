-- Fix #453: Add INSERT policy on invoices for platform admins, super admins,
-- org owners, and billing role members so ManualInvoiceDialog can create invoices.
-- Also update the super_admin SELECT policy to include platform_admin.

-- Drop old super_admin read policy and recreate to include platform_admin
DROP POLICY IF EXISTS "Super admins can read all invoices" ON invoices;

CREATE POLICY "Super admins can read all invoices"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('super_admin', 'platform_admin')
    )
  );

-- Allow super_admin / platform_admin to INSERT any invoice
DROP POLICY IF EXISTS "Admins can create invoices" ON invoices;
CREATE POLICY "Admins can create invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('super_admin', 'platform_admin')
    )
  );

-- Allow org owners and billing members to INSERT invoices for their own org
DROP POLICY IF EXISTS "Org owners and billing members can create invoices" ON invoices;
CREATE POLICY "Org owners and billing members can create invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = invoices.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'billing')
    )
  );

-- Also allow super_admin / platform_admin to UPDATE invoices (e.g., void/mark paid)
DROP POLICY IF EXISTS "Admins can update invoices" ON invoices;
CREATE POLICY "Admins can update invoices"
  ON invoices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('super_admin', 'platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('super_admin', 'platform_admin')
    )
  );
