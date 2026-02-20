#!/usr/bin/env node

/**
 * Backfill public.users table for existing auth.users
 * This script creates missing public.users records for any auth.users that don't have them
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function backfillUsers() {
  console.log('🔍 Checking for auth users without public.users records...\n')

  try {
    // Get all auth users
    const {
      data: { users: authUsers },
      error: authError,
    } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('❌ Error fetching auth users:', authError)
      return
    }

    console.log(`Found ${authUsers.length} auth users\n`)

    // Get all existing public.users
    const { data: publicUsers, error: publicError } = await supabase
      .from('users')
      .select('id, email, role')

    if (publicError) {
      console.error('❌ Error fetching public users:', publicError)
      return
    }

    const publicUserIds = new Set(publicUsers.map((u) => u.id))
    console.log(`Found ${publicUsers.length} public.users records\n`)

    // Find auth users missing from public.users
    const missingUsers = authUsers.filter(
      (authUser) => !publicUserIds.has(authUser.id)
    )

    if (missingUsers.length === 0) {
      console.log('✅ All auth users have corresponding public.users records!')
      return
    }

    console.log(
      `⚠️  Found ${missingUsers.length} auth users without public.users records:\n`
    )

    // Create missing public.users records
    for (const authUser of missingUsers) {
      console.log(`Creating public.users record for: ${authUser.email}`)

      const { error: insertError } = await supabase.from('users').insert({
        id: authUser.id,
        email: authUser.email,
        role: 'viewer', // Default role
        organization_id: null, // No organization by default
        created_at: authUser.created_at,
        updated_at: new Date().toISOString(),
      })

      if (insertError) {
        console.error(
          `  ❌ Error creating user ${authUser.email}:`,
          insertError.message
        )
      } else {
        console.log(`  ✅ Created public.users record for ${authUser.email}`)
      }
    }

    console.log('\n✅ Backfill complete!')

    // Show summary
    console.log('\n📊 Summary:')
    console.log(`  Total auth users: ${authUsers.length}`)
    console.log(`  Existing public.users: ${publicUsers.length}`)
    console.log(`  Created records: ${missingUsers.length}`)
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

backfillUsers()
