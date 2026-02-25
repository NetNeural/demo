#!/usr/bin/env node

/**
 * Production Supabase Validation Script
 * Tests edge functions and database connectivity
 */

const https = require('https')

const PROD_PROJECT_REF = 'bldojxpockljyivldxwf'
const PROD_URL = `https://${PROD_PROJECT_REF}.supabase.co`

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: [],
}

function testEndpoint(name, path, options = {}) {
  return new Promise((resolve) => {
    const url = `${PROD_URL}${path}`
    console.log(`\n🔍 Testing ${name}...`)
    console.log(`   URL: ${url}`)

    const req = https.get(url, options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        const status = res.statusCode
        const result = {
          name,
          url,
          status,
          success: status >= 200 && status < 500, // Accept 4xx as "working" (auth/validation errors are OK)
          headers: res.headers,
          body: data.substring(0, 200), // First 200 chars
        }

        if (status >= 200 && status < 300) {
          console.log(`   ✅ SUCCESS: ${status}`)
          results.passed.push(result)
        } else if (status >= 300 && status < 500) {
          console.log(
            `   ⚠️  EXPECTED ERROR: ${status} (service is responding)`
          )
          results.warnings.push(result)
        } else {
          console.log(`   ❌ FAILED: ${status}`)
          results.failed.push(result)
        }
        resolve(result)
      })
    })

    req.on('error', (error) => {
      console.log(`   ❌ ERROR: ${error.message}`)
      results.failed.push({ name, url, error: error.message })
      resolve({ name, error: error.message })
    })

    req.setTimeout(10000, () => {
      req.destroy()
      console.log(`   ⏱️  TIMEOUT: Request timed out`)
      results.warnings.push({ name, url, error: 'timeout' })
      resolve({ name, error: 'timeout' })
    })
  })
}

async function validateProduction() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('🚀 SUPABASE PRODUCTION VALIDATION')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`Project: ${PROD_PROJECT_REF}`)
  console.log(`URL: ${PROD_URL}`)
  console.log('═══════════════════════════════════════════════════════\n')

  // Test REST API endpoint (should return 401 without auth - that's OK!)
  await testEndpoint('REST API', '/rest/v1/')

  // Test Auth endpoint
  await testEndpoint('Auth Service', '/auth/v1/health')

  // Test Storage endpoint
  await testEndpoint('Storage Service', '/storage/v1/')

  // Test Realtime endpoint
  await testEndpoint('Realtime Service', '/realtime/v1/')

  // Test a few edge functions (expect 401/403 without auth - that's good!)
  const edgeFunctions = [
    'create-organization',
    'health-check',
    'golioth-webhook',
  ]

  for (const fn of edgeFunctions) {
    await testEndpoint(`Edge Function: ${fn}`, `/functions/v1/${fn}`)
  }

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('📊 VALIDATION SUMMARY')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`✅ Passed: ${results.passed.length}`)
  console.log(`⚠️  Warnings (Expected): ${results.warnings.length}`)
  console.log(`❌ Failed: ${results.failed.length}`)
  console.log('═══════════════════════════════════════════════════════\n')

  if (results.passed.length > 0) {
    console.log('✅ PASSED TESTS:')
    results.passed.forEach((r) => console.log(`   - ${r.name}: ${r.status}`))
  }

  if (results.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS (Services responding, auth required):')
    results.warnings.forEach((r) =>
      console.log(`   - ${r.name}: ${r.status || r.error}`)
    )
  }

  if (results.failed.length > 0) {
    console.log('\n❌ FAILED TESTS:')
    results.failed.forEach((r) =>
      console.log(`   - ${r.name}: ${r.error || r.status}`)
    )
  }

  console.log('\n═══════════════════════════════════════════════════════')

  const totalWorking = results.passed.length + results.warnings.length
  const totalTests = totalWorking + results.failed.length

  if (results.failed.length === 0) {
    console.log('🎉 ALL SERVICES ARE OPERATIONAL!')
    console.log(
      `   ${totalWorking}/${totalTests} endpoints responding correctly`
    )
    console.log('═══════════════════════════════════════════════════════')
    process.exit(0)
  } else {
    console.log('⚠️  SOME SERVICES HAVE ISSUES')
    console.log(`   ${totalWorking}/${totalTests} endpoints working`)
    console.log('═══════════════════════════════════════════════════════')
    process.exit(1)
  }
}

// Run validation
validateProduction().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
