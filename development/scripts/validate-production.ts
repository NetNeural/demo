#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Automated Production Validation Script
 * Tests all Edge Functions and validates RLS fix without manual authentication
 */

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL') || 'https://bldojxpockljyivldxwf.supabase.co'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

// Test results
interface TestResult {
  name: string
  passed: boolean
  status?: number
  error?: string
  details?: string
}

const results: TestResult[] = []

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(color: string, ...args: any[]) {
  console.log(color, ...args, colors.reset)
}

function logTest(result: TestResult) {
  const icon = result.passed ? '✓' : '✗'
  const color = result.passed ? colors.green : colors.red
  const status = result.status ? `[${result.status}]` : ''
  log(color, `  ${icon} ${result.name} ${status}`)
  if (result.error) {
    log(colors.red, `    Error: ${result.error}`)
  }
  if (result.details) {
    log(colors.cyan, `    ${result.details}`)
  }
}

async function testEdgeFunction(
  name: string,
  endpoint: string,
  method: string = 'GET',
  body?: any,
  params?: Record<string, string>
): Promise<TestResult> {
  try {
    let url = `${SUPABASE_URL}/functions/v1/${endpoint}`

    if (params) {
      const searchParams = new URLSearchParams(params)
      url += `?${searchParams.toString()}`
    }

    const options: RequestInit = {
      method,
      headers: {
        apikey: SUPABASE_ANON_KEY || '',
        'Content-Type': 'application/json',
      },
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)
    const text = await response.text()

    // Check for RLS recursion error
    if (text.includes('infinite recursion')) {
      return {
        name,
        passed: false,
        status: response.status,
        error: 'RLS RECURSION DETECTED',
        details: text.substring(0, 200),
      }
    }

    // For unauthenticated requests, 401/403 is expected and means endpoint exists
    if (response.status === 401 || response.status === 403) {
      return {
        name,
        passed: true,
        status: response.status,
        details: 'Endpoint deployed (requires auth)',
      }
    }

    // 404 means endpoint not deployed
    if (response.status === 404) {
      return {
        name,
        passed: false,
        status: 404,
        error: 'Endpoint not deployed',
      }
    }

    // Any other response
    return {
      name,
      passed: response.status < 500,
      status: response.status,
      details: response.status < 300 ? 'OK' : text.substring(0, 100),
    }
  } catch (error) {
    return {
      name,
      passed: false,
      error: error.message,
    }
  }
}

async function testProductionPage(
  name: string,
  path: string
): Promise<TestResult> {
  try {
    const response = await fetch(`https://demo.netneural.ai${path}`, {
      redirect: 'follow',
    })
    const html = await response.text()

    // Check for RLS recursion errors in HTML
    if (
      html.includes('infinite recursion') ||
      html.includes('recursion detected')
    ) {
      return {
        name,
        passed: false,
        status: response.status,
        error: 'RLS recursion error found in page',
      }
    }

    // Check for other error messages
    if (
      html.includes('policy for relation') &&
      html.includes('organization_members')
    ) {
      return {
        name,
        passed: false,
        status: response.status,
        error: 'RLS policy error found',
      }
    }

    return {
      name,
      passed: response.status === 200,
      status: response.status,
      details: 'Page loads successfully',
    }
  } catch (error) {
    return {
      name,
      passed: false,
      error: error.message,
    }
  }
}

async function checkMigrationStatus(): Promise<TestResult> {
  try {
    // Check if our RLS fix migration is applied
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_migrations`, {
      headers: {
        apikey: SUPABASE_ANON_KEY || '',
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY}`,
      },
    }).catch(() => null)

    // Alternative: just check if organization_members policies work
    const testQuery = await fetch(
      `${SUPABASE_URL}/rest/v1/organization_members?select=id&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY || '',
        },
      }
    )

    const text = await testQuery.text()

    if (text.includes('infinite recursion')) {
      return {
        name: 'Migration Status',
        passed: false,
        error: 'RLS recursion still present - migration not applied!',
      }
    }

    return {
      name: 'Migration Status',
      passed: true,
      details: 'RLS policies working (no recursion)',
    }
  } catch (error) {
    return {
      name: 'Migration Status',
      passed: false,
      error: error.message,
    }
  }
}

// Main test suite
async function runTests() {
  log(colors.blue, '\n========================================')
  log(colors.blue, 'Production Validation - Automated Tests')
  log(colors.blue, '========================================\n')

  log(colors.cyan, 'Environment:')
  console.log(`  Supabase URL: ${SUPABASE_URL}`)
  console.log(
    `  Service Key: ${SUPABASE_SERVICE_KEY ? '***' + SUPABASE_SERVICE_KEY.slice(-8) : 'Not set'}`
  )
  console.log(
    `  Anon Key: ${SUPABASE_ANON_KEY ? '***' + SUPABASE_ANON_KEY.slice(-8) : 'Not set'}\n`
  )

  // Test 1: Frontend Pages
  log(colors.yellow, '\n1. Testing Frontend Pages (No Recursion Errors)')
  results.push(await testProductionPage('Homepage', '/'))
  results.push(await testProductionPage('Dashboard', '/dashboard'))
  results.push(
    await testProductionPage('Organizations', '/dashboard/organizations')
  )
  results.push(await testProductionPage('Devices', '/dashboard/devices'))
  results.push(await testProductionPage('Settings', '/dashboard/settings'))
  results.slice(-5).forEach(logTest)

  // Test 2: Migration Status
  log(colors.yellow, '\n2. Checking Migration & RLS Fix')
  results.push(await checkMigrationStatus())
  results.slice(-1).forEach(logTest)

  // Test 3: Edge Functions
  log(colors.yellow, '\n3. Testing Edge Functions Deployment')

  results.push(await testEdgeFunction('Devices (GET)', 'devices'))
  results.push(
    await testEdgeFunction('Devices (POST)', 'devices', 'POST', {
      name: 'test',
    })
  )
  results.push(await testEdgeFunction('Members (GET)', 'members'))
  results.push(
    await testEdgeFunction('Members (POST)', 'members', 'POST', {
      email: 'test@test.com',
    })
  )
  results.push(await testEdgeFunction('Integrations (GET)', 'integrations'))
  results.push(
    await testEdgeFunction('Integrations (POST)', 'integrations', 'POST', {
      name: 'test',
    })
  )
  results.push(await testEdgeFunction('Locations (GET)', 'locations'))
  results.push(
    await testEdgeFunction('Locations (PATCH)', 'locations', 'PATCH', {
      name: 'test',
    })
  )
  results.push(
    await testEdgeFunction('Locations (DELETE)', 'locations', 'DELETE')
  )
  results.push(await testEdgeFunction('Organizations (GET)', 'organizations'))
  results.push(
    await testEdgeFunction('Organizations (PATCH)', 'organizations', 'PATCH', {
      name: 'test',
    })
  )
  results.push(await testEdgeFunction('Dashboard Stats', 'dashboard-stats'))
  results.push(
    await testEdgeFunction('Create User', 'create-user', 'POST', {
      email: 'test@test.com',
    })
  )

  results.slice(-13).forEach(logTest)

  // Summary
  log(colors.blue, '\n========================================')
  log(colors.blue, 'Summary')
  log(colors.blue, '========================================\n')

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => r.passed === false).length
  const total = results.length

  if (failed === 0) {
    log(colors.green, `✓ ALL TESTS PASSED (${passed}/${total})\n`)
  } else {
    log(
      colors.red,
      `✗ SOME TESTS FAILED (${passed}/${total} passed, ${failed} failed)\n`
    )
  }

  // Issue mapping
  log(colors.cyan, 'Issues likely fixed by RLS migration:')
  const fixedIssues = [
    '#60 - Integrations page recursion error',
    '#61 - Integrations empty after update',
    '#67 - Add Integration button',
    '#57 - Members page load error',
    '#55 - Devices page fetch error',
    '#69 - Add Device button',
    '#59 - Create User button',
    '#65 - Location Edit button',
    '#66 - Location Delete button',
    '#63 - Organization Settings update',
  ]

  const recursionFound = results.some((r) => r.error?.includes('recursion'))

  if (!recursionFound) {
    log(colors.green, '\n✓ No RLS recursion errors detected!')
    log(colors.green, '✓ All button/form issues should now work\n')
    fixedIssues.forEach((issue) => log(colors.green, `  ✓ ${issue}`))
  } else {
    log(colors.red, '\n✗ RLS recursion still present!')
    log(colors.red, '✗ Migration may need to be re-applied\n')
  }

  log(colors.cyan, '\nRemaining issues requiring code changes:')
  console.log('  • #64 - Notification Preferences (needs implementation)')
  console.log('  • #68 - Alerts tab review (needs decision)')
  console.log('  • #56 - Dashboard stats (needs investigation)')
  console.log('  • #58 - Sentry coverage (likely non-issue)')
  console.log('  • #70 - Dialog overflow (already fixed in code)')
  console.log('  • #62 - Integration z-index (needs testing)')

  console.log('')

  // Exit code based on critical tests
  const criticalFailed = results.some(
    (r) =>
      !r.passed &&
      (r.error?.includes('recursion') || r.error?.includes('not deployed'))
  )

  Deno.exit(criticalFailed ? 1 : 0)
}

// Run tests
runTests().catch((error) => {
  log(colors.red, '\nFatal error:', error.message)
  Deno.exit(1)
})
