-- Create function to get user emails from auth.users
-- This is needed because Edge Functions can't directly query auth.users schema

CREATE OR REPLACE FUNCTION public.get_user_emails(user_ids UUID[])
RETURNS TABLE (email TEXT) 
SECURITY DEFINER
SET search_path = auth, pg_temp
LANGUAGE SQL
AS $$
  SELECT email::TEXT
  FROM auth.users
  WHERE id = ANY(user_ids)
  AND email IS NOT NULL;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_emails(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_emails(UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_emails(UUID[]) TO service_role;

COMMENT ON FUNCTION public.get_user_emails IS 
  'Returns email addresses for given user IDs from auth.users table. Used for alert notifications.';
