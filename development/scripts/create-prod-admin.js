#!/usr/bin/env node

/**
 * Create Admin User in Production Supabase
 * 
 * This script creates a super admin user in your production Supabase instance.
 * Run this once to set up initial admin access.
 * 
 * Requires: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in environment
 */

require('dotenv').config({ path: '../.env.production' })
const { createClient } = require('@supabase/supabase-js')

// Production Supabase credentials from environment
const PROD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const PROD_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!PROD_URL || !PROD_ANON_KEY) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

console.log('🚀 Creating admin user in PRODUCTION Supabase...\n')
console.log('Project:', PROD_URL)
console.log('')

const supabase = createClient(PROD_URL, PROD_ANON_KEY)

async function createAdminUser() {
  const email = 'admin@netneural.ai'
  const password = 'password123'

  console.log(`📧 Email: ${email}`)
  console.log(`🔐 Password: ${password}`)
  console.log('')

  try {
    // Try to sign up the user
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: 'Production Admin'
        },
        emailRedirectTo: undefined
      }
    })

    if (error) {
      if (error.message.includes('already registered')) {
        console.log('✅ User already exists! Try logging in with:')
        console.log(`   Email: ${email}`)
        console.log(`   Password: ${password}`)
        console.log('')
        console.log('If you forgot the password, you need to reset it via Supabase Dashboard.')
        return
      }
      console.error('❌ Error creating user:', error.message)
      console.log('')
      console.log('⚠️  You may need to use the SERVICE ROLE KEY instead.')
      console.log('   Check your Supabase dashboard at:')
      console.log('   https://supabase.com/dashboard/project/bldojxpockljyivldxwf')
      return
    }

    if (data.user) {
      console.log('✅ User created successfully!')
      console.log('')
      console.log('🎉 You can now login with:')
      console.log(`   Email: ${email}`)
      console.log(`   Password: ${password}`)
      console.log('')
      console.log('⚠️  Note: You may need to verify the email first.')
      console.log('   Check your email or disable email confirmation in Supabase Dashboard:')
      console.log('   Authentication → Providers → Email → Disable "Confirm Email"')
    } else {
      console.log('⚠️  User creation status unclear. Check Supabase dashboard.')
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err.message)
    console.log('')
    console.log('💡 Alternative: Create user manually via Supabase Dashboard:')
    console.log('   1. Go to: https://supabase.com/dashboard/project/bldojxpockljyivldxwf')
    console.log('   2. Navigate to: Authentication → Users')
    console.log('   3. Click "Add user" → "Create new user"')
    console.log(`   4. Email: ${email}`)
    console.log(`   5. Password: ${password}`)
    console.log('   6. Check "Auto Confirm User"')
  }
}

createAdminUser()
