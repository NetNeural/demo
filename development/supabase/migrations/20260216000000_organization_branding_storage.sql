-- Migration: Add storage bucket for organization logos and branding assets
-- Date: 2026-02-16

-- Create storage bucket for organization assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-assets',
  'organization-assets',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for organization assets
-- Allow authenticated users to view all organization assets
CREATE POLICY "Anyone can view organization assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'organization-assets');

-- Allow organization owners to upload assets
CREATE POLICY "Organization owners can upload assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'organization-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT o.id
    FROM organizations o
    INNER JOIN organization_members om ON o.id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
  )
);

-- Allow organization owners to update their assets
CREATE POLICY "Organization owners can update assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'organization-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT o.id
    FROM organizations o
    INNER JOIN organization_members om ON o.id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
  )
);

-- Allow organization owners to delete their assets
CREATE POLICY "Organization owners can delete assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'organization-assets'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT o.id
    FROM organizations o
    INNER JOIN organization_members om ON o.id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
  )
);

-- Add comment for documentation
COMMENT ON TABLE storage.buckets IS 'Storage bucket for organization branding assets like logos';
