-- Data Room: Organization Documents
-- Created: 2026-03-02
-- Purpose: Per-org file storage (contracts, compliance, reports, invoices, etc.)

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by           UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  file_name             TEXT NOT NULL,
  file_size             BIGINT NOT NULL DEFAULT 0,
  file_type             TEXT NOT NULL DEFAULT '',
  storage_path          TEXT NOT NULL,          -- path inside the storage bucket
  category              TEXT NOT NULL DEFAULT 'other'
                          CHECK (category IN ('contract','compliance','report','invoice','agreement','other')),
  description           TEXT,
  is_visible_to_members BOOLEAN NOT NULL DEFAULT false, -- owner/admin override to allow all members to see
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_org_documents_org ON org_documents(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_documents_uploaded_by ON org_documents(uploaded_by);

-- ── Updated-at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_org_documents_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_documents_updated_at ON org_documents;
CREATE TRIGGER trg_org_documents_updated_at
  BEFORE UPDATE ON org_documents
  FOR EACH ROW EXECUTE FUNCTION update_org_documents_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE org_documents ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "super_admin_all_org_documents"
  ON org_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

-- Org owners and admins can see ALL documents in their org
CREATE POLICY "org_admin_select_org_documents"
  ON org_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org_documents.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'billing')
    )
  );

-- Regular members can only see documents explicitly shared with them
CREATE POLICY "member_select_visible_org_documents"
  ON org_documents FOR SELECT
  USING (
    is_visible_to_members = true
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org_documents.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Owners, admins, and billing can upload
CREATE POLICY "org_admin_insert_org_documents"
  ON org_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org_documents.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'billing')
    )
  );

-- Owners and admins can update document metadata
CREATE POLICY "org_admin_update_org_documents"
  ON org_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org_documents.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Owners and admins can delete documents
CREATE POLICY "org_admin_delete_org_documents"
  ON org_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org_documents.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- ── Storage Bucket ────────────────────────────────────────────────────────────
-- Create the storage bucket (public = false, file-size limit 50MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-documents',
  'org-documents',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/gif',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Users can upload to their org's folder (path: {org_id}/*)
CREATE POLICY "org_member_upload_documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'org-documents'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id::text = (storage.foldername(name))[1]
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'billing')
    )
  );

-- Storage RLS: Users can read files from orgs they belong to
CREATE POLICY "org_member_read_documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'org-documents'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id::text = (storage.foldername(name))[1]
        AND om.user_id = auth.uid()
    )
  );

-- Storage RLS: Owners/admins can delete files
CREATE POLICY "org_admin_delete_documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'org-documents'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id::text = (storage.foldername(name))[1]
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Super admin storage access
CREATE POLICY "super_admin_all_storage_documents"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'org-documents'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );
