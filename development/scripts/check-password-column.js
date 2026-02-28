#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co'
const STAGING_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(STAGING_URL, STAGING_SERVICE_ROLE_KEY)

async function checkColumn() {
  console.log('🔍 Checking if password_change_required column exists...\n')

  // Try to query the column
  const { data, error } = await supabase
    .from('users')
    .select('id, email, password_change_required')
    .limit(1)

  if (error) {
    console.log('❌ Column does not exist yet!')
    console.log('Error:', error.message)
    console.log('\n📝 Please run this SQL in Supabase SQL Editor:')
    console.log(
      '   https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql/new\n'
    )
    console.log(
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN DEFAULT FALSE;'
    )
    return false
  }

  console.log('✅ Column exists!')
  console.log('Sample data:', data)
  return true
}

checkColumn().catch(console.error)
