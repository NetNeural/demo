#!/usr/bin/env node

/**
 * Create Test Users for NetNeural Development
 * 
 * This script creates test users in Supabase Auth that match the seed data.
 * Run this after resetting the database to set up authentication.
 * 
 * Usage:
 *   node create-test-users.js
 * 
 * Or add to package.json:
 *   "scripts": {
 *     "setup:users": "node scripts/create-test-users.js"
 *   }
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('@supabase/supabase-js')
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!')
  console.error('Required:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  console.error('\nMake sure .env.local has these values.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const testUsers = [
  {
    id: '10000000-0000-0000-0000-000000000000',
    email: 'superadmin@netneural.ai',
    password: 'SuperSecure123!',
    full_name: 'Super Administrator',
    role: 'super_admin'
  },
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@netneural.ai',
    password: 'password123',
    full_name: 'Admin User',
    role: 'org_owner'
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'user@netneural.ai',
    password: 'password123',
    full_name: 'Regular User',
    role: 'user'
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'viewer@netneural.ai',
    password: 'password123',
    full_name: 'Viewer User',
    role: 'viewer'
  }
]

async function createTestUsers() {
  console.log('🚀 Creating test users...\n')

  for (const userData of testUsers) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase.auth.admin.getUserById(userData.id)
      
      if (existingUser && existingUser.user) {
        console.log(`ℹ️  User ${userData.email} already exists (skipping)`)
        continue
      }

      // Create user in Supabase Auth
      const { data, error } = await supabase.auth.admin.createUser({
        id: userData.id,
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          full_name: userData.full_name
        }
      })

      if (error) {
        console.error(`❌ Failed to create ${userData.email}:`, error.message)
        continue
      }

      console.log(`✅ Created auth user: ${userData.email}`)
      console.log(`   ID: ${data.user.id}`)
      console.log(`   Role: ${userData.role}`)
      console.log(`   Password: ${userData.password}`)

      // Create corresponding users table entry
      const { error: usersError } = await supabase
        .from('users')
        .insert({
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role,
          organization_id: userData.role === 'super_admin' ? null : '00000000-0000-0000-0000-000000000001',
          is_active: true
        })

      if (usersError) {
        console.error(`   ⚠️  Failed to create users table entry:`, usersError.message)
      } else {
        console.log(`   ✅ Created users table entry`)
      }

      // Create organization membership for non-super-admin users
      if (userData.role !== 'super_admin') {
        const memberRole = userData.role === 'org_owner' ? 'owner' : 
                          userData.role === 'org_admin' ? 'admin' : 'member'
        
        const { error: memberError } = await supabase
          .from('organization_members')
          .insert({
            organization_id: '00000000-0000-0000-0000-000000000001',
            user_id: userData.id,
            role: memberRole,
            permissions: {
              canManageMembers: ['owner', 'admin'].includes(memberRole),
              canManageDevices: ['owner', 'admin'].includes(memberRole),
              canManageAlerts: true
            }
          })

        if (memberError) {
          console.error(`   ⚠️  Failed to create organization membership:`, memberError.message)
        } else {
          console.log(`   ✅ Created organization membership (role: ${memberRole})`)
        }
      }

      console.log('')

    } catch (err) {
      console.error(`❌ Error creating ${userData.email}:`, err.message)
    }
  }

  console.log('✨ Done! Test users and database entries created.\n')
  console.log('📝 Login credentials:')
  console.log('\n🛡️  SUPER ADMIN (Platform Administrator):')
  console.log('   Email: superadmin@netneural.ai')
  console.log('   Password: SuperSecure123!')
  console.log('   Access: All organizations and platform settings')
  console.log('\n👑 Organization Owner:')
  console.log('   Email: admin@netneural.ai')
  console.log('   Password: password123')
  console.log('\n👤 Regular User:')
  console.log('   Email: user@netneural.ai')
  console.log('   Password: password123')
  console.log('\n👁️  Viewer (Read-Only):')
  console.log('   Email: viewer@netneural.ai')
  console.log('   Password: password123')
  console.log('\n🌐 Navigate to http://localhost:3000/auth/login to sign in.')
}

createTestUsers().catch((err) => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
