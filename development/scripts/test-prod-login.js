#!/usr/bin/env node

/**
 * Test Production Login
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in environment
 */

require('dotenv').config({ path: '../.env.production' })
const { createClient } = require('@supabase/supabase-js')

const PROD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const PROD_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!PROD_URL || !PROD_ANON_KEY) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

console.log('🧪 Testing production login...\n')

const supabase = createClient(PROD_URL, PROD_ANON_KEY)

async function testLogin() {
  const email = 'admin@netneural.ai'
  const password = 'password123'

  console.log(`Attempting login with: ${email}`)

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('\n❌ Login FAILED:', error.message)
    console.log('\n🔍 Possible reasons:')

    if (error.message.includes('Email not confirmed')) {
      console.log('   → Email confirmation is required')
      console.log('   → SOLUTION: Go to Supabase Dashboard:')
      console.log(
        '      1. https://supabase.com/dashboard/project/bldojxpockljyivldxwf'
      )
      console.log('      2. Authentication → Providers → Email')
      console.log('      3. Disable "Confirm email"')
      console.log('      4. Save changes')
      console.log('   → OR manually confirm the user in Authentication → Users')
    } else if (error.message.includes('Invalid')) {
      console.log('   → Wrong email or password')
      console.log('   → Try resetting password via Supabase Dashboard')
    }
    return
  }

  if (data.user) {
    console.log('\n✅ Login SUCCESSFUL!')
    console.log('\n👤 User Info:')
    console.log('   ID:', data.user.id)
    console.log('   Email:', data.user.email)
    console.log(
      '   Email Confirmed:',
      data.user.email_confirmed_at ? 'Yes' : 'No'
    )
    console.log('   Created:', data.user.created_at)
    console.log('\n🎉 You can now login to the production app!')
  }
}

testLogin()
