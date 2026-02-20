#!/usr/bin/env node
/**
 * Check User Organization Bindings
 * 
 * Verifies that all users are properly bound to their organizations
 * and that organization_members entries match users.organization_id
 * 
 * Usage:
 *   node check-user-org-bindings.js [--fix]
 * 
 * Options:
 *   --fix    Automatically fix mismatches (updates users.organization_id)
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      process.env[key] = value
    }
  })
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const shouldFix = process.argv.includes('--fix')

console.log('🔍 Checking User Organization Bindings\n')
console.log('=' .repeat(60))

async function main() {
  try {
    // First, let's test the connection
    console.log('Testing Supabase connection...')
    console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
    console.log(`Service Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20)}...`)
    
    // 1. Get all users with their org assignments
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        organization_id,
        role
      `)
      .order('email')

    if (usersError) {
      console.error('❌ Query error:', usersError)
      throw usersError
    }
    if (!users) {
      console.error('❌ No users found or query returned null')
      console.error('This usually means:')
      console.error('  1. Invalid Supabase credentials')
      console.error('  2. Table doesn\'t exist')
      console.error('  3. No permission to access the table')
      return
    }

    console.log(`\n📊 Total Users: ${users.length}\n`)

    // 2. Get all organization memberships
    const { data: memberships, error: membershipsError } = await supabase
      .from('organization_members')
      .select(`
        user_id,
        organization_id,
        role,
        joined_at
      `)

    if (membershipsError) throw membershipsError
    const safeMembers = memberships || []

    console.log(`📊 Total Memberships: ${safeMembers.length}\n`)

    // 3. Get all organizations for name lookup
    const { data: organizations, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name')

    if (orgsError) throw orgsError
    const safeOrgs = organizations || []

    const orgMap = new Map(safeOrgs.map(o => [o.id, o.name]))

    // 4. Analyze each user
    const issues = []
    const perfect = []

    for (const user of users) {
      const userMemberships = safeMembers.filter(m => m.user_id === user.id)
      
      if (userMemberships.length === 0) {
        // User has no memberships
        if (user.organization_id) {
          issues.push({
            type: 'orphan_org',
            user,
            message: `Has org_id (${orgMap.get(user.organization_id)}) but no memberships`
          })
        } else {
          issues.push({
            type: 'no_org',
            user,
            message: 'No organization assignment and no memberships'
          })
        }
      } else if (userMemberships.length === 1) {
        // User has one membership
        const membership = userMemberships[0]
        if (user.organization_id !== membership.organization_id) {
          issues.push({
            type: 'mismatch',
            user,
            membership,
            message: `Mismatch: users.org=${orgMap.get(user.organization_id) || 'NULL'}, member.org=${orgMap.get(membership.organization_id)}`
          })
        } else {
          perfect.push({ user, membership })
        }
      } else {
        // User has multiple memberships
        const primaryMembership = userMemberships.find(m => m.organization_id === user.organization_id)
        if (!primaryMembership) {
          issues.push({
            type: 'multi_mismatch',
            user,
            memberships: userMemberships,
            message: `Multiple memberships (${userMemberships.length}) but org_id doesn't match any: ${orgMap.get(user.organization_id) || 'NULL'}`
          })
        } else {
          perfect.push({ user, membership: primaryMembership, extra: userMemberships.length - 1 })
        }
      }
    }

    // 5. Report findings
    console.log('=' .repeat(60))
    console.log(`\n✅ Correctly Bound Users: ${perfect.length}`)
    console.log(`❌ Issues Found: ${issues.length}\n`)

    if (issues.length > 0) {
      console.log('ISSUES:\n')
      
      issues.forEach((issue, idx) => {
        console.log(`${idx + 1}. ${issue.user.email} (${issue.user.full_name || 'No name'})`)
        console.log(`   Type: ${issue.type}`)
        console.log(`   ${issue.message}`)
        if (issue.membership) {
          console.log(`   Membership Org: ${orgMap.get(issue.membership.organization_id)}`)
          console.log(`   Role: ${issue.membership.role}`)
        }
        console.log()
      })

      // 6. Apply fixes if requested
      if (shouldFix) {
        console.log('=' .repeat(60))
        console.log('\n🔧 APPLYING FIXES...\n')

        let fixed = 0
        let failed = 0

        for (const issue of issues) {
          if (issue.type === 'mismatch' || issue.type === 'multi_mismatch') {
            // Update user's organization_id to match their membership
            const targetOrgId = issue.membership 
              ? issue.membership.organization_id 
              : issue.memberships[0].organization_id

            console.log(`Fixing ${issue.user.email}: ${orgMap.get(targetOrgId)}`)

            const { error } = await supabase
              .from('users')
              .update({ 
                organization_id: targetOrgId,
                updated_at: new Date().toISOString()
              })
              .eq('id', issue.user.id)

            if (error) {
              console.error(`   ❌ Failed: ${error.message}`)
              failed++
            } else {
              console.log(`   ✅ Fixed`)
              fixed++
            }
          } else {
            console.log(`Skipping ${issue.user.email}: ${issue.type} (manual fix required)`)
          }
        }

        console.log(`\n✅ Fixed: ${fixed}`)
        console.log(`❌ Failed: ${failed}`)
        console.log(`⏭️  Skipped: ${issues.length - fixed - failed}`)
      } else {
        console.log('ℹ️  Run with --fix flag to automatically fix mismatches\n')
      }
    } else {
      console.log('✅ All users are correctly bound to their organizations!\n')
    }

    // 7. Summary by organization
    console.log('=' .repeat(60))
    console.log('\n📊 Users per Organization:\n')

    const orgStats = new Map()
    
    for (const user of users) {
      if (user.organization_id) {
        const orgName = orgMap.get(user.organization_id) || 'Unknown'
        const stats = orgStats.get(orgName) || { users: 0, owners: 0, admins: 0 }
        stats.users++
        
        const membership = memberships.find(m => 
          m.user_id === user.id && 
          m.organization_id === user.organization_id
        )
        
        if (membership) {
          if (membership.role === 'owner') stats.owners++
          if (membership.role === 'admin') stats.admins++
        }
        
        orgStats.set(orgName, stats)
      }
    }

    for (const [orgName, stats] of [...orgStats.entries()].sort()) {
      console.log(`${orgName}:`)
      console.log(`  Total: ${stats.users}`)
      console.log(`  Owners: ${stats.owners}`)
      console.log(`  Admins: ${stats.admins}`)
      console.log()
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()
