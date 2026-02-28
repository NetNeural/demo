-- Migration: Add screenshot support for feedback submissions
-- Creates a feedback-attachments storage bucket and adds screenshot_urls column
-- Issue: User feedback requested ability to attach screenshots to bug reports

-- ============================================================================
-- 1. CREATE STORAGE BUCKET
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'feedback-attachments') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'feedback-attachments',
      'feedback-attachments',
      true,  -- Public so GitHub issue can embed the image
      5242880, -- 5MB limit per file
      ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
    );
    RAISE NOTICE 'feedback-attachments bucket created';
  ELSE
    UPDATE storage.buckets
    SET
      public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
    WHERE id = 'feedback-attachments';
    RAISE NOTICE 'feedback-attachments bucket updated';
  END IF;
END $$;

-- ============================================================================
-- 2. STORAGE POLICIES
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "feedback_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "feedback_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "feedback_attachments_delete" ON storage.objects;

-- Anyone can view (public bucket for GitHub embedding)
CREATE POLICY "feedback_attachments_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback-attachments');

-- Authenticated users can upload screenshots
CREATE POLICY "feedback_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback-attachments');

-- Users can delete their own uploads (path starts with their user ID)
CREATE POLICY "feedback_attachments_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'feedback-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- 3. ADD SCREENSHOT COLUMN TO FEEDBACK TABLE
-- ============================================================================

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS screenshot_urls TEXT[] DEFAULT '{}';

COMMENT ON COLUMN feedback.screenshot_urls IS 'Array of public URLs for attached screenshots';
