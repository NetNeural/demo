-- Enable PostgreSQL extensions required by the application
-- This migration runs before all others to ensure extensions are available

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Additional useful extensions for IoT platform
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
