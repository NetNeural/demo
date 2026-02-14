#!/usr/bin/env node

/**
 * Apply migration to add password_change_required column
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co';
const STAGING_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2JteGljcWlrbWFwZnFvdWNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNzgwOSwiZXhwIjoyMDg2NTkzODA5fQ.tGj8TfFUR3DiXWEYT1Lt41zvzxb5HipUnpfF-QfHbjY';

async function applyMigration() {
  console.log('🔧 Applying migration: password_change_required column...\n');

  const migrationSQL = `
-- Add password change required flag for temporary passwords
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_password_change_required 
ON users(password_change_required) 
WHERE password_change_required = TRUE;

-- Add comment
COMMENT ON COLUMN users.password_change_required IS 'True if user has a temporary password and must change it on next login';
  `;

  console.log('SQL to execute:');
  console.log(migrationSQL);
  console.log('\n📝 Please run this SQL in Supabase SQL Editor:');
  console.log('   https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql/new\n');
  console.log('Or apply via Supabase CLI if available.');
}

applyMigration().catch(console.error);
