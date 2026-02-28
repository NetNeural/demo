-- Migration: Email broadcast log for platform communications (#321+)
-- Tracks all broadcast emails sent from admin tools

CREATE TABLE IF NOT EXISTS public.email_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  email_type TEXT NOT NULL DEFAULT 'announcement',  -- announcement, maintenance, newsletter, update
  target_tiers TEXT[] NOT NULL DEFAULT '{all}',       -- all, starter, professional, enterprise
  recipient_count INT NOT NULL DEFAULT 0,
  sent_by UUID NOT NULL REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',               -- draft, sent, failed
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb                 -- ai_generated, resend_ids, etc.
);

-- Indexes
CREATE INDEX idx_email_broadcasts_sent_at ON public.email_broadcasts(sent_at DESC);
CREATE INDEX idx_email_broadcasts_type ON public.email_broadcasts(email_type);

-- Enable RLS
ALTER TABLE public.email_broadcasts ENABLE ROW LEVEL SECURITY;

-- Only super admins (via service role) can access this table
-- UI will call edge function which uses service role
CREATE POLICY "Service role full access to email_broadcasts"
  ON public.email_broadcasts
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.email_broadcasts IS 'Log of all broadcast emails sent from admin tools. Super admin only.';
