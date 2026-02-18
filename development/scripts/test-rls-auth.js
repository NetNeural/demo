#!/usr/bin/env node

/**
 * Quick diagnostic for admin@netneural.ai
 */

const { createClient } = require('@supabase/supabase-js')

const PROJECT_REF = 'atgbmxicqikmapfqouco'
const PROD_URL = `https://${PROJECT_REF}.supabase.co`
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const TARGET_EMAIL = 'admin@netneural.ai'

if (!SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(PROD_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function diagnose() {
  console.log(`🔍 Diagnostic for: ${TARGET_EMAIL}`)
  console.log('')

  // Get auth user
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const authUser = authUsers.users.find(u => u.email === TARGET_EMAIL)
  
  if (!authUser) {
    console.log('❌ Auth user not found')
    return
  }

  console.log('✅ Auth User')
  console.log(`   ID: ${authUser.id}`)
  console.log('')

  // Check profile with service role (bypasses RLS)
  console.log('📋 Checking profile with SERVICE ROLE (bypasses RLS)...')
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, email, role, organization_id')
    .eq('id', authUser.id)
    .single()

  if (profileError) {
    console.log('❌ Profile NOT found (service role):', profileError.message)
  } else {
    console.log('✅ Profile exists (service role)')
    console.log('   Role:', profile.role)
    console.log('   Org ID:', profile.organization_id)
  }
  console.log('')

  // Now test with ANON key (simulates client query with RLS)
  console.log('📋 Testing with ANON KEY (simulates real login with RLS)...')
  
  // First authenticate
  const clientSupabase = createClient(PROD_URL, ANON_KEY)
  
  const { data: signInData, error: signInError } = await clientSupabase.auth.signInWithPassword({
    email: TARGET_EMAIL,
    password: 'Admin123!'
  })

  if (signInError) {
    console.log('❌ Sign in failed:', signInError.message)
    return
  }

  console.log('✅ Authentication successful')
  console.log(`   Session user ID: ${signInData.user.id}`)
  console.log('')

  // Try to fetch profile (this is what getCurrentUser does)
  console.log('📋 Fetching profile with authenticated user (RLS applied)...')
  const { data: userProfile, error: userProfileError } = await clientSupabase
    .from('users')
    .select('role, organization_id')
    .eq('id', signInData.user.id)
    .single()

  if (userProfileError) {
    console.log('❌ FAILED to fetch profile with RLS')
    console.log(`   Error: ${userProfileError.message}`)
    console.log(`   Code: ${userProfileError.code}`)
    console.log('')
    console.log('THIS IS THE PROBLEM! RLS is blocking the query.')
    console.log('')
    
    // Try without .single() to see if data exists but query is wrong
    const { data: allProfiles, error: allError } = await clientSupabase
      .from('users')
      .select('role, organization_id')
      .eq('id', signInData.user.id)

    if (allError) {
      console.log('❌ Even without .single():', allError.message)
    } else {
      console.log(`Found ${allProfiles?.length || 0} profiles without .single()`)
      if (allProfiles && allProfiles.length > 0) {
        console.log('Profile data:', allProfiles[0])
      }
    }
  } else {
    console.log('✅ Profile fetched successfully with RLS!')
    console.log('   Role:', userProfile.role)
    console.log('   Org ID:', userProfile.organization_id)
    console.log('')
    console.log('RLS is working correctly! The issue might be elsewhere.')
  }

  await clientSupabase.auth.signOut()
}

diagnose()
