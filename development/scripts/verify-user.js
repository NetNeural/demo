#!/usr/bin/env node

/**
 * Verify the user record exists using service role
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verify() {
  const userId = 'f7f359cb-71bc-4b9b-b531-f1fbc709f4d2' // Latest test user

  console.log(`\nChecking if user ${userId} exists in public.users...\n`)

  // Query as service role (bypasses RLS)
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('❌ Error:', error.message)
  } else if (data) {
    console.log('✅ SUCCESS! User record exists:')
    console.log(JSON.stringify(data, null, 2))
  } else {
    console.log('❌ No record found')
  }
}

verify()
