-- Simple seed data for development
INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'admin@example.com', now(), now(), now()),
  ('550e8400-e29b-41d4-a716-446655440001', 'user@example.com', now(), now(), now())
ON CONFLICT (id) DO NOTHING;
