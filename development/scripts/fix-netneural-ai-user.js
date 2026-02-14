#!/usr/bin/env node

/**
 * Fix User Profile for admin@netneural.ai
 * Creates profile, organization membership for any auth user
 */

const { createClient } = require('@supabase/supabase-js')

const PROJECT_REF = 'atgbmxicqikmapfqouco'
const PROD_URL = `https://${PROJECT_REF}.supabase.co`
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const TARGET_EMAIL = 'admin@netneural.ai'
const ORG_ID = '00000000-0000-0000-0000-000000000001'

if (!SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY')
  console.error('Export it: export SUPABASE_SERVICE_ROLE_KEY=your-key')
  process.exit(1)
}

console.log(`🔧 Creating profile for: ${TARGET_EMAIL}`)
console.log('')

const supabase = createClient(PROD_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function fix() {
  try {
    // Get auth user
    console.log('📋 Finding auth user...')
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Error:', authError.message)
      return
    }

    const authUser = authUsers.users.find(u => u.email === TARGET_EMAIL)
    
    if (!authUser) {
      console.log(`❌ User ${TARGET_EMAIL} not found in auth.users`)
      console.log('Please create the user first in Supabase Dashboard')
      return
    }
    
    console.log(`✅ Found auth user`)
    console.log(`   ID: ${authUser.id}`)
    console.log('')

    // Create user profile
    console.log('📋 Creating user profile...')
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        email: TARGET_EMAIL,
        full_name: 'Admin User',
        role: 'org_owner',
        organization_id: ORG_ID
      })
    
    if (profileError) {
      if (profileError.code === '23505') {
        console.log('⚠️  Profile already exists')
      } else {
        console.error('❌ Error:', profileError.message)
        return
      }
    } else {
      console.log('✅ User profile created')
    }
    console.log('')

    // Create organization membership
    console.log('📋 Creating organization membership...')
    const { error: membershipError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: ORG_ID,
        user_id: authUser.id,
        role: 'owner'
      })
    
    if (membershipError) {
      if (membershipError.code === '23505') {
        console.log('⚠️  Membership already exists')
      } else {
        console.error('❌ Error:', membershipError.message)
        return
      }
    } else {
      console.log('✅ Organization membership created')
    }
    console.log('')

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ SUCCESS!')
    console.log('')
    console.log('You can now log in with:')
    console.log(`   Email: ${TARGET_EMAIL}`)
    console.log('   URL: https://demo-stage.netneural.ai')
    console.log('')
    console.log('Clear browser cache or use incognito mode!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
  }
}

fix()
