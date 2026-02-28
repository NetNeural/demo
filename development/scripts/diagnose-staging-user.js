#!/usr/bin/env node

/**
 * Diagnose and Fix profile_load_failed for Existing Staging User
 *
 * This script checks why admin@netneural.ai is getting profile_load_failed
 * and can automatically fix the issue.
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.STAGING_URL || process.argv[2]
const supabaseServiceKey = process.env.STAGING_SERVICE_KEY || process.argv[3]
const userEmail = 'admin@netneural.ai'

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!')
  console.error('\nUsage:')
  console.error('  STAGING_URL=https://atgbmxicqikmapfqouco.supabase.co \\')
  console.error('  STAGING_SERVICE_KEY=your-service-key \\')
  console.error('  node scripts/diagnose-staging-user.js')
  process.exit(1)
}

console.log('🔍 Diagnosing profile_load_failed for:', userEmail)
console.log('Target:', supabaseUrl)
console.log('')

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function diagnose() {
  const issues = []
  const fixes = []

  try {
    // Step 1: Check if auth user exists
    console.log('1️⃣ Checking auth.users table...')
    const { data: authUsers, error: authError } =
      await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('❌ Cannot access auth.users:', authError.message)
      return
    }

    const authUser = authUsers.users.find((u) => u.email === userEmail)

    if (!authUser) {
      console.log('❌ User does NOT exist in auth.users')
      issues.push('Auth user missing')
      console.log(
        '\n💡 Solution: Create user via Supabase Dashboard > Authentication > Add User'
      )
      return
    }

    console.log('✅ Auth user exists')
    console.log('   User ID:', authUser.id)
    console.log(
      '   Email confirmed:',
      authUser.email_confirmed_at ? 'Yes' : 'No'
    )

    const userId = authUser.id

    // Step 2: Check if user profile exists
    console.log('\n2️⃣ Checking public.users table...')
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !userProfile) {
      console.log('❌ User profile does NOT exist in public.users')
      issues.push('User profile missing')
      fixes.push({
        type: 'create_profile',
        userId,
        email: userEmail,
      })
    } else {
      console.log('✅ User profile exists')
      console.log('   Role:', userProfile.role)
      console.log(
        '   Organization ID:',
        userProfile.organization_id || 'NULL ❌'
      )
      console.log('   Active:', userProfile.is_active)

      if (!userProfile.organization_id) {
        issues.push('User has no organization_id')
        fixes.push({
          type: 'set_organization',
          userId,
          profileExists: true,
        })
      }

      // Step 3: Check if organization exists
      if (userProfile.organization_id) {
        console.log('\n3️⃣ Checking organization...')
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', userProfile.organization_id)
          .single()

        if (orgError || !org) {
          console.log(
            '❌ Organization does NOT exist:',
            userProfile.organization_id
          )
          issues.push('Organization missing')
          fixes.push({
            type: 'create_organization',
            orgId: userProfile.organization_id,
            userId,
          })
        } else {
          console.log('✅ Organization exists:', org.name)
        }

        // Step 4: Check organization membership
        console.log('\n4️⃣ Checking organization_members...')
        const { data: membership, error: memberError } = await supabase
          .from('organization_members')
          .select('*')
          .eq('user_id', userId)
          .eq('organization_id', userProfile.organization_id)
          .single()

        if (memberError || !membership) {
          console.log('❌ Organization membership does NOT exist')
          issues.push('Organization membership missing')
          fixes.push({
            type: 'create_membership',
            userId,
            orgId: userProfile.organization_id,
          })
        } else {
          console.log('✅ Organization membership exists')
          console.log('   Role:', membership.role)
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    if (issues.length === 0) {
      console.log('✅ No issues found! User should be able to login.')
      console.log('\nIf still getting profile_load_failed, check:')
      console.log('  1. Browser cache (try incognito mode)')
      console.log('  2. RLS policies (might have circular dependency)')
      console.log('  3. Frontend console errors')
    } else {
      console.log('❌ Issues found:', issues.length)
      issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`))

      console.log('\n🔧 Auto-fix available!')
      console.log(
        'Run this script with --fix flag to automatically fix these issues:'
      )
      console.log(`\nSTAGING_URL="${supabaseUrl}" \\`)
      console.log(`STAGING_SERVICE_KEY="..." \\`)
      console.log(`node scripts/diagnose-staging-user.js --fix`)
    }
    console.log('='.repeat(60))

    // Apply fixes if --fix flag
    if (process.argv.includes('--fix') && fixes.length > 0) {
      console.log('\n🔧 Applying fixes...\n')
      await applyFixes(fixes, userId, userEmail)
    }
  } catch (error) {
    console.error('\n💥 Error:', error.message)
    console.error(error)
  }
}

async function applyFixes(fixes, userId, userEmail) {
  const orgId = '00000000-0000-0000-0000-000000000001'

  for (const fix of fixes) {
    try {
      if (fix.type === 'create_organization') {
        console.log('Creating organization...')
        const { error } = await supabase.from('organizations').upsert({
          id: orgId,
          name: 'NetNeural Staging',
          slug: 'netneural-staging',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

        if (error && !error.message.includes('duplicate')) {
          console.error('❌ Failed:', error.message)
        } else {
          console.log('✅ Organization created')
        }
      }

      if (fix.type === 'create_profile') {
        console.log('Creating user profile...')
        const { error } = await supabase.from('users').insert({
          id: userId,
          email: userEmail,
          full_name: 'Admin User',
          role: 'org_owner',
          organization_id: orgId,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

        if (error && !error.message.includes('duplicate')) {
          console.error('❌ Failed:', error.message)
        } else {
          console.log('✅ User profile created')
        }
      }

      if (fix.type === 'set_organization') {
        console.log('Setting organization_id...')

        // First ensure organization exists
        await supabase.from('organizations').upsert({
          id: orgId,
          name: 'NetNeural Staging',
          slug: 'netneural-staging',
        })

        // Then update user
        const { error } = await supabase
          .from('users')
          .update({ organization_id: orgId })
          .eq('id', userId)

        if (error) {
          console.error('❌ Failed:', error.message)
        } else {
          console.log('✅ Organization assigned to user')
        }
      }

      if (fix.type === 'create_membership') {
        console.log('Creating organization membership...')
        const { error } = await supabase.from('organization_members').upsert({
          organization_id: fix.orgId || orgId,
          user_id: userId,
          role: 'owner',
          created_at: new Date().toISOString(),
        })

        if (error && !error.message.includes('duplicate')) {
          console.error('❌ Failed:', error.message)
        } else {
          console.log('✅ Membership created')
        }
      }
    } catch (error) {
      console.error('❌ Error applying fix:', error.message)
    }
  }

  console.log('\n✅ All fixes applied!')
  console.log('\n🧪 Test now:')
  console.log('   1. Go to: https://demo-stage.netneural.ai')
  console.log('   2. Login with:', userEmail)
  console.log('   3. Should work! ✅')
}

diagnose()
