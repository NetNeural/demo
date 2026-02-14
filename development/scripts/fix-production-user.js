#!/usr/bin/env node

/**
 * Fix Production User Profile
 * 
 * This script diagnoses and fixes the "profile_load_failed" error for admin@netneural.com
 * 
 * What it does:
 * 1. Checks if user exists in auth.users
 * 2. Checks if user profile exists in public.users table
 * 3. Checks if organization exists
 * 4. Creates missing records
 * 
 * Usage:
 *   node scripts/fix-production-user.js
 */

require('dotenv').config({ path: '.env.production' })
const { createClient } = require('@supabase/supabase-js')

const PROJECT_REF = 'atgbmxicqikmapfqouco'
const PROD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http') 
  ? process.env.NEXT_PUBLIC_SUPABASE_URL 
  : `https://${PROJECT_REF}.supabase.co`
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY')
  console.error('\nExport it first:')
  console.error('   export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key')
  console.error('\nGet it from:')
  console.error(`   https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api`)
  process.exit(1)
}

console.log('🔍 Diagnosing production user profile issue...\n')
console.log('Project:', PROD_URL)
console.log('')

const supabase = createClient(PROD_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const TARGET_EMAIL = 'admin@netneural.com'
const TARGET_USER_ID = '22222222-2222-2222-2222-222222222222'
const ORG_ID = '00000000-0000-0000-0000-000000000001'

async function diagnoseAndFix() {
  try {
    // Step 1: Check auth.users
    console.log('📋 Step 1: Checking auth.users...')
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Error listing auth users:', authError.message)
      return
    }

    const authUser = authUsers.users.find(u => u.email === TARGET_EMAIL)
    
    if (!authUser) {
      console.log('❌ User NOT found in auth.users')
      console.log('\n🔧 Creating auth user...')
      
      const { data: newAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
        email: TARGET_EMAIL,
        password: 'password123',
        email_confirm: true,
        user_metadata: {
          full_name: 'Admin User',
          role: 'org_owner'
        }
      })
      
      if (createAuthError) {
        console.error('❌ Failed to create auth user:', createAuthError.message)
        return
      }
      
      console.log('✅ Auth user created:', newAuthUser.user.id)
      console.log('')
    } else {
      console.log('✅ User exists in auth.users')
      console.log('   ID:', authUser.id)
      console.log('   Email:', authUser.email)
      console.log('   Email Confirmed:', !!authUser.email_confirmed_at)
      console.log('')
    }

    const userId = authUser?.id || TARGET_USER_ID

    // Step 2: Check organizations table
    console.log('📋 Step 2: Checking organizations table...')
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', ORG_ID)
      .single()
    
    if (orgError || !org) {
      console.log('❌ Organization NOT found')
      console.log('\n🔧 Creating organization...')
      
      const { error: createOrgError } = await supabase
        .from('organizations')
        .insert({
          id: ORG_ID,
          name: 'NetNeural Demo',
          slug: 'netneural-demo',
          description: 'Demo organization for NetNeural IoT Platform',
          subscription_tier: 'enterprise',
          is_active: true,
          settings: {}
        })
      
      if (createOrgError) {
        console.error('❌ Failed to create organization:', createOrgError.message)
        // Try to continue anyway
      } else {
        console.log('✅ Organization created')
      }
      console.log('')
    } else {
      console.log('✅ Organization exists')
      console.log('   ID:', org.id)
      console.log('   Name:', org.name)
      console.log('')
    }

    // Step 3: Check public.users table
    console.log('📋 Step 3: Checking public.users table...')
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (profileError) {
      console.log('❌ Error querying user profile:', profileError.message)
      console.log('   Code:', profileError.code)
      
      // Check if it's an RLS policy issue
      if (profileError.message.includes('policy') || 
          profileError.message.includes('permission') ||
          profileError.code === 'PGRST301' ||
          profileError.code === '42501') {
        console.log('\n⚠️  THIS LOOKS LIKE AN RLS POLICY ISSUE!')
        console.log('   The database has Row-Level Security policies that are blocking the query.')
        console.log('\n🔧 Solution: Apply the RLS fix migration')
        console.log('   Run: bash scripts/fix-production-rls.sh')
        console.log('   Or manually apply: supabase/migrations/20260214000001_fix_users_rls_circular_dependency.sql')
        return
      }
    }
    
    if (!userProfile) {
      console.log('❌ User profile NOT found in public.users table')
      console.log('   This is the main cause of "profile_load_failed" error')
      console.log('\n🔧 Creating user profile...')
      
      const { error: createProfileError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: TARGET_EMAIL,
          full_name: 'Admin User',
          role: 'org_owner',
          organization_id: ORG_ID
        })
      
      if (createProfileError) {
        console.error('❌ Failed to create user profile:', createProfileError.message)
        console.error('   Details:', createProfileError)
        return
      }
      
      console.log('✅ User profile created')
      console.log('')
    } else {
      console.log('✅ User profile exists')
      console.log('   ID:', userProfile.id)
      console.log('   Email:', userProfile.email)
      console.log('   Role:', userProfile.role)
      console.log('   Organization ID:', userProfile.organization_id)
      
      if (!userProfile.organization_id) {
        console.log('\n⚠️  WARNING: User has NO organization_id!')
        console.log('🔧 Updating user profile...')
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ organization_id: ORG_ID })
          .eq('id', userId)
        
        if (updateError) {
          console.error('❌ Failed to update user profile:', updateError.message)
        } else {
          console.log('✅ User profile updated with organization_id')
        }
      }
      console.log('')
    }

    // Step 4: Check organization_members table
    console.log('📋 Step 4: Checking organization_members table...')
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', ORG_ID)
      .single()
    
    if (membershipError || !membership) {
      console.log('❌ Organization membership NOT found')
      console.log('\n🔧 Creating organization membership...')
      
      const { error: createMembershipError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: ORG_ID,
          user_id: userId,
          role: 'owner'
        })
      
      if (createMembershipError) {
        console.error('❌ Failed to create membership:', createMembershipError.message)
      } else {
        console.log('✅ Organization membership created')
      }
      console.log('')
    } else {
      console.log('✅ Organization membership exists')
      console.log('   Role:', membership.role)
      console.log('')
    }

    // Final verification
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎉 DIAGNOSIS COMPLETE\n')
    console.log('✅ All required data should now be in place!')
    console.log('')
    console.log('📝 Login credentials:')
    console.log('   URL: https://demo-stage.netneural.ai')
    console.log('   Email: admin@netneural.com')
    console.log('   Password: password123')
    console.log('')
    console.log('If you still see the error, check:')
    console.log('1. Browser cache (try incognito/private mode)')
    console.log('2. Supabase RLS policies (check users table policies)')
    console.log('3. Network tab in browser dev tools for API errors')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message)
    console.error(error)
  }
}

diagnoseAndFix()
