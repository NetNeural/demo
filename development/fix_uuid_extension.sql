-- Fix UUID extension for production
-- Run this in Supabase SQL Editor BEFORE running migrations

-- Ensure uuid-ossp is in the public schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- Test the function works
SELECT uuid_generate_v4();
