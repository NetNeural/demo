#!/usr/bin/env node

/**
 * Create Test User for Staging Environment
 * 
 * This script creates a test user in your staging Supabase instance.
 * 
 * Usage:
 *   STAGING_URL=https://your-ref.supabase.co \
 *   STAGING_SERVICE_KEY=your-key \
 *   node scripts/create-staging-user.js
 */

const { createClient } = require('@supabase/supabase-js')

// Get from environment or command line
const supabaseUrl = process.env.STAGING_URL || process.argv[2]
const supabaseServiceKey = process.env.STAGING_SERVICE_KEY || process.argv[3]

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!')
  console.error('\nUsage:')
  console.error('  STAGING_URL=https://your-ref.supabase.co \\')
  console.error('  STAGING_SERVICE_KEY=your-service-key \\')
  console.error('  node scripts/create-staging-user.js')
  console.error('\nOr:')
  console.error('  node scripts/create-staging-user.js <url> <service-key>')
  process.exit(1)
}

console.log('🚀 Creating staging test user...')
console.log('Target:', supabaseUrl)
console.log('')

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createStagingUser() {
  const userId = '10000000-0000-0000-0000-000000000001'
  const email = 'staging-admin@netneural.ai'
  const password = 'StagingTest2026!'
  const fullName = 'Staging Administrator'

  try {
    // Step 1: Create a test organization first
    console.log('1️⃣ Creating test organization...')
    const orgId = '00000000-0000-0000-0000-000000000001'
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .upsert({
        id: orgId,
        name: 'NetNeural Staging',
        slug: 'netneural-staging',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (orgError && !orgError.message.includes('duplicate')) {
      console.error('❌ Failed to create organization:', orgError.message)
    } else {
      console.log('✅ Organization created/exists:', orgId)
    }

    // Step 2: Check if user already exists
    console.log('\n2️⃣ Checking for existing user...')
    const { data: existingAuthUser } = await supabase.auth.admin.getUserById(userId)
    
    if (existingAuthUser && existingAuthUser.user) {
      console.log('ℹ️  Auth user already exists:', email)
    } else {
      // Create user in Supabase Auth
      console.log('📧 Creating auth user...')
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        id: userId,
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName
        }
      })

      if (authError) {
        console.error('❌ Failed to create auth user:', authError.message)
        if (authError.message.includes('already registered')) {
          console.log('ℹ️  User already exists, continuing...')
        } else {
          throw authError
        }
      } else {
        console.log('✅ Auth user created:', authData.user.email)
      }
    }

    // Step 3: Create profile in users table
    console.log('\n3️⃣ Creating user profile...')
    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: email,
        full_name: fullName,
        role: 'org_owner',
        organization_id: orgId,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (profileError && !profileError.message.includes('duplicate')) {
      console.error('❌ Failed to create user profile:', profileError.message)
      throw profileError
    }
    console.log('✅ User profile created')

    // Step 4: Create organization membership
    console.log('\n4️⃣ Creating organization membership...')
    const { error: memberError } = await supabase
      .from('organization_members')
      .upsert({
        organization_id: orgId,
        user_id: userId,
        role: 'owner',
        created_at: new Date().toISOString()
      })

    if (memberError && !memberError.message.includes('duplicate')) {
      console.error('❌ Failed to create membership:', memberError.message)
      throw memberError
    }
    console.log('✅ Organization membership created')

    // Success!
    console.log('\n' + '='.repeat(60))
    console.log('🎉 Staging user created successfully!')
    console.log('='.repeat(60))
    console.log('\n📝 Login credentials:')
    console.log('   Email:', email)
    console.log('   Password:', password)
    console.log('\n🌐 Test at: https://demo-stage.netneural.ai')
    console.log('\n✅ User setup complete!')

  } catch (error) {
    console.error('\n💥 Error:', error.message)
    process.exit(1)
  }
}

createStagingUser()
