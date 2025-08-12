-- Fix activity_logs table to add organization_id column
-- This migration adds the missing organization_id column to activity_logs

-- Add organization_id column if it doesn't exist
ALTER TABLE public.activity_logs 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Create the index that was failing
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_time ON public.activity_logs(organization_id, created_at DESC);
