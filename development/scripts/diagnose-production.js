#!/usr/bin/env node

/**
 * Comprehensive Production Diagnostic
 * Checks RLS policies, user data, and database state
 */

const { createClient } = require('@supabase/supabase-js')

const PROJECT_REF = 'atgbmxicqikmapfqouco'
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`

console.log('🔍 Comprehensive Production Diagnostic')
console.log('=====================================')
console.log(`Project: ${PROJECT_URL}`)
console.log('')

// Check for environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || PROJECT_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY')
  console.error('')
  console.error('Please set it:')
  console.error(`  export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`)
  console.error('')
  console.error('Get it from:')
  console.error(`  https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api`)
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function diagnose() {
  console.log('✅ Service key found')
  console.log('')

  try {
    // Check 1: RLS Policies on users table
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 CHECK 1: RLS Policies on users table')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    let policies = null
    let policyError = null

    try {
      // Try to get policies (may not have permission)
      const result = await supabase.rpc('exec_sql', {
        sql: `
          SELECT policyname, cmd, qual 
          FROM pg_policies 
          WHERE tablename = 'users' 
          AND schemaname = 'public'
          ORDER BY policyname;
        `
      })
      policies = result.data
      policyError = result.error
    } catch (err) {
      // RPC not available, skip policy check
      policyError = err
    }

    if (policyError) {
      console.log('⚠️  Cannot query policies directly (this is normal)')
      console.log('   Checking if our fix policy exists...')
      console.log('')
    } else if (policies) {
      console.log(`Found ${policies.length} policies:`)
      policies.forEach(p => {
        console.log(`  - ${p.policyname} (${p.cmd})`)
      })
      console.log('')

      // Check for the problematic policies
      const problematicPolicies = [
        'Super admins can manage all users',
        'Users can view users in their organization',
        'Org admins can manage users in their organization'
      ]

      const hasProblematic = policies.some(p => problematicPolicies.includes(p.policyname))
      const hasFixed = policies.some(p => p.policyname === 'Users can view own profile')

      if (hasProblematic) {
        console.log('❌ OLD PROBLEMATIC POLICIES STILL EXIST')
        console.log('   These cause circular dependency issues')
        console.log('')
      }

      if (hasFixed) {
        console.log('✅ NEW FIXED POLICY EXISTS: "Users can view own profile"')
        console.log('')
      } else {
        console.log('❌ NEW FIXED POLICY NOT FOUND')
        console.log('   The migration has not been applied yet')
        console.log('')
      }
    }

    // Check 2: User exists in auth.users
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 CHECK 2: User in auth.users')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.log('❌ Cannot list auth users:', authError.message)
      console.log('')
    } else {
      const targetUser = authUsers.users.find(u => u.email === 'admin@netneural.com')
      
      if (targetUser) {
        console.log('✅ User exists in auth.users')
        console.log(`   ID: ${targetUser.id}`)
        console.log(`   Email: ${targetUser.email}`)
        console.log(`   Confirmed: ${!!targetUser.email_confirmed_at}`)
        console.log('')
      } else {
        console.log('❌ User NOT found in auth.users')
        console.log('   Available users:')
        authUsers.users.forEach(u => console.log(`     - ${u.email}`))
        console.log('')
      }
    }

    // Check 3: Organization exists
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 CHECK 3: Organizations table')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .limit(10)

    if (orgError) {
      console.log('❌ Cannot query organizations:', orgError.message)
      console.log('   Code:', orgError.code)
      console.log('')
    } else {
      console.log(`✅ Found ${orgs.length} organizations:`)
      orgs.forEach(o => console.log(`   - ${o.name} (${o.slug})`))
      console.log('')
    }

    // Check 4: Users table (using service role, bypasses RLS)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 CHECK 4: Users table (public.users)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role, organization_id')

    if (usersError) {
      console.log('❌ Cannot query users table:', usersError.message)
      console.log('   Code:', usersError.code)
      console.log('')
      
      if (usersError.code === 'PGRST204') {
        console.log('   This means the users table is EMPTY')
        console.log('')
      }
    } else if (!users || users.length === 0) {
      console.log('❌ Users table is EMPTY')
      console.log('   No user profiles exist')
      console.log('')
    } else {
      console.log(`✅ Found ${users.length} users:`)
      users.forEach(u => {
        console.log(`   - ${u.email}`)
        console.log(`     Role: ${u.role}`)
        console.log(`     Org ID: ${u.organization_id || 'NULL'}`)
      })
      console.log('')

      const targetUserProfile = users.find(u => u.email === 'admin@netneural.com')
      if (!targetUserProfile) {
        console.log('⚠️  admin@netneural.com NOT in public.users table')
        console.log('')
      }
    }

    // Check 5: Try to simulate the login query
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 CHECK 5: Simulate Login Query')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    console.log('This simulates what getCurrentUser() does...')
    console.log('')

    // Get a user ID to test with
    const testUserId = authUsers?.users?.find(u => u.email === 'admin@netneural.com')?.id

    if (testUserId) {
      console.log(`Testing with user ID: ${testUserId}`)
      console.log('')

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role, organization_id')
        .eq('id', testUserId)
        .single()

      if (profileError) {
        console.log('❌ FAILED to fetch user profile')
        console.log('   Error:', profileError.message)
        console.log('   Code:', profileError.code)
        console.log('')
        console.log('   This is why you get profile_load_failed!')
        console.log('')
      } else {
        console.log('✅ Successfully fetched profile')
        console.log('   Role:', profile.role)
        console.log('   Organization ID:', profile.organization_id)
        console.log('')
      }
    } else {
      console.log('⚠️  Cannot test - no auth user found')
      console.log('')
    }

    // Summary and recommendations
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 SUMMARY & RECOMMENDATIONS')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // Determine the main issues
    const hasAuthUser = authUsers?.users?.some(u => u.email === 'admin@netneural.com')
    const hasUserProfile = users?.some(u => u.email === 'admin@netneural.com')
    const hasOrganization = orgs && orgs.length > 0
    const tableEmpty = !users || users.length === 0

    if (tableEmpty) {
      console.log('🔴 CRITICAL: Database is empty or not seeded')
      console.log('')
      console.log('Solutions:')
      console.log('  1. Run seed script:')
      console.log('     cd development')
      console.log('     supabase db reset --linked')
      console.log('')
      console.log('  2. Or manually insert data via Supabase Dashboard')
      console.log('')
    } else if (!hasUserProfile && hasAuthUser) {
      console.log('🔴 CRITICAL: User exists in auth but NOT in public.users')
      console.log('')
      console.log('Solution:')
      console.log('  node scripts/fix-production-user.js')
      console.log('')
    } else if (!hasAuthUser) {
      console.log('🔴 CRITICAL: User does not exist in auth.users')
      console.log('')
      console.log('Solution:')
      console.log('  Create user via Supabase Dashboard or run setup script')
      console.log('')
    } else {
      console.log('🟡 Database has data, but RLS policies may be wrong')
      console.log('')
      console.log('Solution:')
      console.log('  bash scripts/quick-fix-rls.sh')
      console.log('')
    }

    console.log('For full diagnostic output, check the sections above.')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  } catch (error) {
    console.error('')
    console.error('❌ Unexpected error:', error.message)
    console.error(error)
  }
}

diagnose()
