#!/usr/bin/env node
/**
 * Simple User-Organization Binding Checker
 * Checks if users.organization_id matches organization_members entries
 */

import { createClient } from '@supabase/supabase-js'

// Try to load from environment or .env.local
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing credentials. Set these environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

console.log('🔍 Checking User Organization Bindings\n')
console.log('='.repeat(60))
console.log(`🔌 Connecting to: ${supabaseUrl}`)
console.log(`🔑 Using key: ${supabaseKey.substring(0, 30)}...`)
console.log('='.repeat(60))

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})

async function checkBindings() {
  try {
    // Test with a simple query first
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true })

    if (testError) {
      console.error('❌ Connection test failed:', testError.message)
      console.error('   Details:', JSON.stringify(testError, null, 2))
      return
    }

    console.log(`\n✅ Connection successful! Found ${testData} users\n`)

    // Now get the actual data
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name, organization_id, role')
      .order('email')

    if (usersError) {
      console.error('❌ Users query failed:', usersError.message)
      return
    }

    if (!users || users.length === 0) {
      console.log('ℹ️  No users in database')
      return
    }

    console.log(`📊 Analyzing ${users.length} users...\n`)

    // Get memberships
    const { data: memberships, error: membError } = await supabase
      .from('organization_members')
      .select('user_id, organization_id, role')

    if (membError) {
      console.error('❌ Memberships query failed:', membError.message)
      return
    }

    // Get organizations for names
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name')

    if (orgsError) {
      console.error('❌ Organizations query failed:', orgsError.message)
      return
    }

    const orgMap = new Map((orgs || []).map((o) => [o.id, o.name]))
    const memberMap = new Map()
    ;(memberships || []).forEach((m) => {
      if (!memberMap.has(m.user_id)) {
        memberMap.set(m.user_id, [])
      }
      memberMap.get(m.user_id).push(m)
    })

    // Check each user
    const issues = []
    const ok = []

    for (const user of users) {
      const userMembs = memberMap.get(user.id) || []
      const userOrgName = orgMap.get(user.organization_id) || 'NONE'

      if (userMembs.length === 0) {
        if (user.organization_id) {
          issues.push({
            user,
            issue: `Has org_id (${userOrgName}) but no memberships`,
          })
        }
      } else {
        const match = userMembs.find(
          (m) => m.organization_id === user.organization_id
        )
        if (!match) {
          const membOrgNames = userMembs
            .map((m) => orgMap.get(m.organization_id))
            .join(', ')
          issues.push({
            user,
            issue: `org_id=${userOrgName} but memberships in: ${membOrgNames}`,
          })
        } else {
          ok.push(user)
        }
      }
    }

    // Report
    console.log('='.repeat(60))
    console.log(`✅ Correct: ${ok.length}`)
    console.log(`❌ Issues:  ${issues.length}`)
    console.log('='.repeat(60))

    if (issues.length > 0) {
      console.log('\n⚠️  ISSUES FOUND:\n')
      issues.forEach(({ user, issue }) => {
        console.log(`❌ ${user.email}`)
        console.log(`   ${issue}`)
        console.log(`   User ID: ${user.id}`)
        console.log()
      })
    }

    if (ok.length > 0) {
      console.log('\n✅ CORRECT BINDINGS:\n')
      ok.forEach((user) => {
        console.log(`✓ ${user.email} → ${orgMap.get(user.organization_id)}`)
      })
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message)
    console.error(error)
  }
}

checkBindings()
