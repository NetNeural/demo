-- Grant INSERT permission on alerts table to authenticated users
-- Fix: The INSERT RLS policy (20260216000006) exists but the table-level
-- GRANT only had SELECT, UPDATE — PostgreSQL rejects the insert before
-- RLS policies are even evaluated.

GRANT INSERT ON alerts TO authenticated;
