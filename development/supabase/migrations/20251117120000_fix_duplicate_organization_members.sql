-- Fix duplicate organization_members causing "Cannot add member" error
-- Issue: #93 - Cannot add new member due to duplicate rows
-- This migration cleans up any duplicate entries and ensures data integrity

-- ============================================================================
-- Step 1: Identify and log duplicates
-- ============================================================================

DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT organization_id, user_id, COUNT(*) as count
    FROM organization_members
    GROUP BY organization_id, user_id
    HAVING COUNT(*) > 1
  ) duplicates;
  
  RAISE NOTICE 'Found % duplicate organization_member entries', duplicate_count;
END $$;

-- ============================================================================
-- Step 2: Remove duplicates (keep the oldest entry per user+org)
-- ============================================================================

DELETE FROM organization_members
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY organization_id, user_id 
             ORDER BY created_at ASC, id ASC
           ) as row_num
    FROM organization_members
  ) ranked
  WHERE row_num > 1
);

-- ============================================================================
-- Step 3: Ensure UNIQUE constraint exists
-- ============================================================================

-- Drop existing constraint if it exists (safe)
ALTER TABLE organization_members 
  DROP CONSTRAINT IF EXISTS organization_members_organization_id_user_id_key;

-- Add the unique constraint
ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_organization_id_user_id_key 
  UNIQUE (organization_id, user_id);

-- ============================================================================
-- Step 4: Add validation function to prevent future duplicates
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_duplicate_membership()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if membership already exists
  IF EXISTS (
    SELECT 1 
    FROM organization_members 
    WHERE organization_id = NEW.organization_id 
      AND user_id = NEW.user_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'User is already a member of this organization'
      USING ERRCODE = '23505', -- unique_violation
            DETAIL = 'organization_id=' || NEW.organization_id || ', user_id=' || NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 5: Add trigger to enforce validation
-- ============================================================================

DROP TRIGGER IF EXISTS check_duplicate_membership ON organization_members;

CREATE TRIGGER check_duplicate_membership
  BEFORE INSERT OR UPDATE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_membership();

-- ============================================================================
-- Step 6: Add index for performance
-- ============================================================================

-- This index is already created by the UNIQUE constraint, but we ensure it exists
CREATE INDEX IF NOT EXISTS idx_organization_members_org_user 
  ON organization_members(organization_id, user_id);

-- ============================================================================
-- Verification Query (for testing)
-- ============================================================================

-- Check for any remaining duplicates
DO $$
DECLARE
  remaining_duplicates INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_duplicates
  FROM (
    SELECT organization_id, user_id, COUNT(*) as count
    FROM organization_members
    GROUP BY organization_id, user_id
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF remaining_duplicates > 0 THEN
    RAISE EXCEPTION 'Still have % duplicate entries after cleanup!', remaining_duplicates;
  ELSE
    RAISE NOTICE '✅ No duplicate organization_members entries found';
  END IF;
END $$;
