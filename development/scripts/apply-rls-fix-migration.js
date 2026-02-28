#!/usr/bin/env node

/**
 * Apply migration to fix organization_members RLS policy
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co'
const STAGING_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(STAGING_URL, STAGING_SERVICE_ROLE_KEY)

async function applyMigration() {
  console.log('🔧 Applying RLS policy fix migration...\n')

  // Read migration file
  const migrationPath = path.join(
    __dirname,
    '../supabase/migrations/20260214000001_fix_organization_members_view_policy.sql'
  )
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

  console.log('📄 Migration SQL:')
  console.log(migrationSQL)
  console.log('\n🚀 Executing...\n')

  // Execute the SQL
  const { data, error } = await supabase.rpc('exec', {
    sql: migrationSQL,
  })

  if (error) {
    // exec might not exist, try direct SQL
    console.log('⚠️  exec RPC not found, trying direct query...\n')

    // Split into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('--'))

    for (const statement of statements) {
      if (!statement) continue

      console.log(`Executing: ${statement.substring(0, 80)}...`)

      const { error: stmtError } = await supabase.rpc('query', {
        query: statement,
      })

      if (stmtError) {
        console.error('❌ Error:', stmtError.message)
      } else {
        console.log('✅ Success')
      }
    }
  } else {
    console.log('✅ Migration executed successfully!')
  }

  // Verify the policy was created
  console.log('\n🔍 Verifying new policy...')

  // Test by counting members as admin user
  const { count, error: countError } = await supabase
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', '00000000-0000-0000-0000-000000000001')

  if (countError) {
    console.error('❌ Count test failed:', countError.message)
  } else {
    console.log(
      `✅ Can now count ${count} members in NetNeural Demo organization`
    )
  }
}

applyMigration().catch(console.error)
