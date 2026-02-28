#!/usr/bin/env node

/**
 * Check which migrations have been applied to staging database
 * Compares local migrations directory with staging's supabase_migrations.version table
 */

const fs = require('fs')
const path = require('path')
const https = require('https')

// Read migrations from local directory
const migrationsDir = path.join(__dirname, '../supabase/migrations')
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql') && !f.endsWith('.skip'))
  .sort()

console.log('🔍 Local Migrations Found:', migrationFiles.length)

// Staging database connection (use service role key)
const STAGING_URL =
  process.env.STAGING_URL || 'https://atgbmxicqikmapfqouco.supabase.co'
const STAGING_SERVICE_ROLE_KEY = process.env.STAGING_SERVICE_ROLE_KEY

if (!STAGING_SERVICE_ROLE_KEY) {
  console.error(
    '\n❌ STAGING_SERVICE_ROLE_KEY environment variable is required'
  )
  console.error('')
  console.error('Usage:')
  console.error(
    '  STAGING_SERVICE_ROLE_KEY=<your-key> node scripts/check-staging-migrations.js'
  )
  console.error('')
  console.error('Or get it from GitHub secrets:')
  console.error('  gh secret list')
  console.error(
    '  export STAGING_SERVICE_ROLE_KEY=$(gh secret get STAGING_SERVICE_ROLE_KEY)'
  )
  console.error('  node scripts/check-staging-migrations.js')
  process.exit(1)
}

function httpsRequest(url, headers) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve({
                ok: true,
                status: res.statusCode,
                data: JSON.parse(data),
              })
            } catch (e) {
              resolve({ ok: true, status: res.statusCode, data: data })
            }
          } else {
            resolve({ ok: false, status: res.statusCode, error: data })
          }
        })
      })
      .on('error', reject)
  })
}

async function checkStagingMigrations() {
  try {
    const response = await httpsRequest(
      `${STAGING_URL}/rest/v1/supabase_migrations?select=version`,
      {
        apikey: STAGING_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${STAGING_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      }
    )

    if (!response.ok) {
      console.error(
        '❌ Failed to query staging migrations table:',
        response.status,
        response.error
      )
      console.log(
        '\n⚠️  Cannot verify migrations. Table may not exist or is not accessible.'
      )
      console.log(
        '💡 Possible table names: supabase_migrations, _supabase_migrations, schema_migrations'
      )
      console.log('\n📋 All local migrations that should be applied:')
      migrationFiles.forEach((f, i) => console.log(`   ${i + 1}. ${f}`))
      return
    }

    const data = response.data
    const appliedVersions = new Set(data.map((row) => row.version))

    console.log('✅ Applied Migrations in Staging:', appliedVersions.size)
    console.log('')

    compareMigrations(migrationFiles, appliedVersions)
  } catch (err) {
    console.error('❌ Error:', err.message)
    console.log(
      '\n⚠️  Cannot verify migrations. Ensure STAGING_SERVICE_ROLE_KEY is correct.'
    )
  }
}

function compareMigrations(localFiles, appliedVersions) {
  const missing = []
  const applied = []

  for (const file of localFiles) {
    // Extract version from filename (first part before underscore or first 14 digits)
    const match = file.match(/^(\d{14,})/)
    const version = match ? match[1] : null

    if (!version) {
      console.log('⚠️  Could not parse version from:', file)
      continue
    }

    if (appliedVersions.has(version)) {
      applied.push(file)
    } else {
      missing.push(file)
    }
  }

  console.log('\n✅ APPLIED TO STAGING (' + applied.length + '):')
  if (applied.length === 0) {
    console.log('   (none detected - verify table schema)')
  } else {
    applied.slice(0, 5).forEach((f) => console.log('   ✓', f))
    if (applied.length > 5) {
      console.log(`   ... and ${applied.length - 5} more`)
    }
  }

  console.log('\n❌ MISSING FROM STAGING (' + missing.length + '):')
  if (missing.length === 0) {
    console.log('   (none - all migrations applied!)')
  } else {
    missing.forEach((f) => console.log('   ✗', f))
  }

  if (missing.length > 0) {
    console.log('\n💡 To apply missing migrations to staging:')
    console.log('   1. Run: npx supabase db push --linked')
    console.log('   2. Or apply manually via Supabase Dashboard > SQL Editor')
    console.log(
      '   3. Critical for AI Analytics: 20250109000003_telemetry_all_integrations.sql'
    )
  }
}

checkStagingMigrations()
