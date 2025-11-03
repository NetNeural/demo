#!/usr/bin/env node

/**
 * Trigger password reset for production user
 * This will also confirm the email as a side effect
 */

const { createClient } = require('@supabase/supabase-js')

const PROD_URL = 'https://bldojxpockljyivldxwf.supabase.co'
const PROD_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tsanlpdmxkeHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMjY5NTUsImV4cCI6MjA3MDYwMjk1NX0.qkvYx-8ucC5BsqzLcXxIW9TQqc94_dFbGYz5rVSwyRQ'

console.log('🔐 Sending password reset email...\n')

const supabase = createClient(PROD_URL, PROD_ANON_KEY)

async function resetPassword() {
  const email = 'admin@netneural.ai'

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://netneural.github.io/MonoRepo/auth/callback'
  })

  if (error) {
    console.error('❌ Error:', error.message)
    console.log('\n⚠️  This means one of:')
    console.log('   1. Email confirmation is blocking password resets too')
    console.log('   2. The email provider is not configured')
    console.log('   3. You need the service role key or dashboard access')
    console.log('\n💡 SOLUTION: You MUST get access to the Supabase dashboard')
    console.log('   Ask whoever created the project: bldojxpockljyivldxwf')
    return
  }

  console.log('✅ Password reset email sent!')
  console.log('\n📧 Check the email: admin@netneural.ai')
  console.log('   Click the link in the email to reset password')
  console.log('   This will also confirm the email address')
}

resetPassword()
