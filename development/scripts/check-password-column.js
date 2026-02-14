#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co';
const STAGING_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2JteGljcWlrbWFwZnFvdWNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNzgwOSwiZXhwIjoyMDg2NTkzODA5fQ.tGj8TfFUR3DiXWEYT1Lt41zvzxb5HipUnpfF-QfHbjY';

const supabase = createClient(STAGING_URL, STAGING_SERVICE_ROLE_KEY);

async function checkColumn() {
  console.log('🔍 Checking if password_change_required column exists...\n');

  // Try to query the column
  const { data, error } = await supabase
    .from('users')
    .select('id, email, password_change_required')
    .limit(1);

  if (error) {
    console.log('❌ Column does not exist yet!');
    console.log('Error:', error.message);
    console.log('\n📝 Please run this SQL in Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql/new\n');
    console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN DEFAULT FALSE;');
    return false;
  }

  console.log('✅ Column exists!');
  console.log('Sample data:', data);
  return true;
}

checkColumn().catch(console.error);
