-- Migration: Expand organization_members role constraint to include billing and viewer
-- Ticket: Billing role missing from dropdowns
-- Date: 2026-02-26

-- 1. Drop the existing CHECK constraint on role column
ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

-- 2. Add expanded CHECK constraint including billing and viewer roles
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('owner', 'admin', 'billing', 'member', 'viewer'));
