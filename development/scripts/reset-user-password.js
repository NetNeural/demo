#!/usr/bin/env node

/**
 * Check auth user status and reset password if needed
 */

const { createClient } = require('@supabase/supabase-js')

const PROJECT_REF = 'atgbmxicqikmapfqouco'
const PROD_URL = `https://${PROJECT_REF}.supabase.co`
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const TARGET_EMAIL = 'admin@netneural.ai'
const NEW_PASSWORD = 'Admin123!'

if (!SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

console.log(`🔍 Checking auth status for: ${TARGET_EMAIL}`)
console.log('')

const supabase = createClient(PROD_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function checkAndFix() {
  try {
    // Get auth user
    const { data: authUsers, error: authError } =
      await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('❌ Error:', authError.message)
      return
    }

    const authUser = authUsers.users.find((u) => u.email === TARGET_EMAIL)

    if (!authUser) {
      console.log(`❌ User ${TARGET_EMAIL} not found in auth`)
      return
    }

    console.log('✅ Auth user found')
    console.log(`   ID: ${authUser.id}`)
    console.log(`   Email: ${authUser.email}`)
    console.log(`   Email Confirmed: ${!!authUser.email_confirmed_at}`)
    console.log(`   Created: ${authUser.created_at}`)
    console.log(`   Last Sign In: ${authUser.last_sign_in_at || 'Never'}`)
    console.log('')

    // Check if email is confirmed
    if (!authUser.email_confirmed_at) {
      console.log('⚠️  Email is NOT confirmed')
      console.log('   Confirming email...')

      await supabase.auth.admin.updateUserById(authUser.id, {
        email_confirm: true,
      })

      console.log('✅ Email confirmed')
      console.log('')
    }

    // Reset password
    console.log(`🔧 Resetting password to: ${NEW_PASSWORD}`)

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      authUser.id,
      { password: NEW_PASSWORD }
    )

    if (updateError) {
      console.error('❌ Error resetting password:', updateError.message)
      return
    }

    console.log('✅ Password reset successful')
    console.log('')

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ SUCCESS!')
    console.log('')
    console.log('Login credentials:')
    console.log(`   URL: https://demo-stage.netneural.ai`)
    console.log(`   Email: ${TARGET_EMAIL}`)
    console.log(`   Password: ${NEW_PASSWORD}`)
    console.log('')
    console.log('Try logging in now (use incognito mode)!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
  }
}

checkAndFix()
