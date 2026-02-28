-- Add lifecycle tracking fields for inactive/unactivated accounts
-- Issue #184: reminder cadence every 5 days, disable/delete at 20 days

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS inactive_reminder_last_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_inactive_lifecycle_candidates
ON public.users (created_at, inactive_reminder_last_sent_at)
WHERE is_active = true AND (last_login IS NULL OR password_change_required = true);

COMMENT ON COLUMN public.users.inactive_reminder_last_sent_at IS
'Last time an inactivity reminder email was sent for accounts that have not logged in/activated.';
