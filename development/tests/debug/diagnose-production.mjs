import { chromium } from 'playwright'

const PRODUCTION_URL = 'https://demo.netneural.ai'
const TEST_EMAIL = 'kaidream78@gmail.com'
const TEST_PASSWORD = 'Welcome2NetNeural!'

async function diagnoseProduction() {
  console.log('🔍 DETAILED PRODUCTION DIAGNOSIS\n')
  console.log('='.repeat(70))

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  })
  const page = await context.newPage()

  const issues = []
  const failedRequests = []

  // Capture all failed requests
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedRequests.push({
        status: response.status(),
        url: response.url(),
        method: response.request().method(),
      })
    }
  })

  try {
    // Login
    console.log('🔐 Logging in...')
    await page.goto(PRODUCTION_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 15000 })
    console.log('✅ Login successful\n')

    // Check navigation menu
    console.log('🔍 CHECKING NAVIGATION MENU')
    console.log('-'.repeat(70))

    const navItems = await page
      .locator(
        'nav a, nav button, [role="navigation"] a, [role="navigation"] button'
      )
      .allTextContents()
    console.log('Available navigation items:', navItems.length)
    navItems.forEach((item) => console.log(`  - ${item.trim()}`))
    console.log('')

    // Check for Organizations link
    const hasOrganizations = navItems.some((item) =>
      item.includes('Organization')
    )
    console.log(`Organizations link present: ${hasOrganizations ? '✅' : '❌'}`)

    if (!hasOrganizations) {
      issues.push({
        severity: 'CRITICAL',
        component: 'Navigation',
        issue: 'Organizations link missing from navigation menu',
      })
    }
    console.log('')

    // Test Devices page API calls
    console.log('🔍 TESTING DEVICES PAGE')
    console.log('-'.repeat(70))

    failedRequests.length = 0 // Clear previous
    await page.click('text=Devices')
    await page.waitForURL('**/devices**', { timeout: 10000 })
    await page.waitForTimeout(3000)

    const deviceCount = await page.locator('table tbody tr').count()
    console.log(`Devices found: ${deviceCount}`)

    if (deviceCount === 0) {
      console.log('❌ No devices loaded')
      issues.push({
        severity: 'HIGH',
        component: 'Devices Page',
        issue: 'No devices displayed - API may be failing',
      })
    } else {
      console.log('✅ Devices loaded successfully')
    }

    if (failedRequests.length > 0) {
      console.log('\n❌ Failed API Requests on Devices page:')
      failedRequests.forEach((req) => {
        console.log(`   ${req.status} ${req.method} ${req.url}`)
        issues.push({
          severity: 'HIGH',
          component: 'Devices API',
          issue: `${req.status} error on ${req.url}`,
        })
      })
    }
    console.log('')

    // Test edge function connectivity
    console.log('🔍 TESTING EDGE FUNCTIONS CONNECTIVITY')
    console.log('-'.repeat(70))

    // Try to call organizations edge function directly
    const orgResponse = await page.evaluate(async () => {
      try {
        const response = await fetch(
          'https://bldojxpockljyivldxwf.supabase.co/functions/v1/organizations',
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('supabase.auth.token')}`,
              'Content-Type': 'application/json',
            },
          }
        )
        return {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText,
        }
      } catch (error) {
        return {
          error: error.message,
        }
      }
    })

    console.log('Organizations edge function test:')
    console.log(`  Status: ${orgResponse.status || 'ERROR'}`)
    console.log(`  OK: ${orgResponse.ok || false}`)
    if (orgResponse.error) {
      console.log(`  Error: ${orgResponse.error}`)
      issues.push({
        severity: 'CRITICAL',
        component: 'Edge Functions',
        issue: `Organizations edge function unreachable: ${orgResponse.error}`,
      })
    }
    console.log('')

    // Check for CORS issues
    console.log('🔍 CHECKING FOR CORS ISSUES')
    console.log('-'.repeat(70))

    const corsTest = await page.evaluate(() => {
      const errors = []
      const originalFetch = window.fetch

      // Check if there are any CORS-related errors in console
      const consoleErrors =
        window.localStorage.getItem('_debug_cors_errors') || '[]'

      return {
        hasCorsErrors:
          consoleErrors.includes('CORS') || consoleErrors.includes('cors'),
        supabaseUrl: window.location.hostname,
      }
    })

    console.log(`Production hostname: ${corsTest.supabaseUrl}`)
    console.log('')

    // Test Supabase client initialization
    console.log('🔍 CHECKING SUPABASE CLIENT')
    console.log('-'.repeat(70))

    const supabaseStatus = await page.evaluate(() => {
      const authToken = localStorage.getItem(
        'sb-bldojxpockljyivldxwf-auth-token'
      )
      const hasAuth = !!authToken

      return {
        hasAuthToken: hasAuth,
        authTokenLength: authToken ? authToken.length : 0,
      }
    })

    console.log(
      `Auth token present: ${supabaseStatus.hasAuthToken ? '✅' : '❌'}`
    )
    console.log(`Auth token length: ${supabaseStatus.authTokenLength}`)

    if (!supabaseStatus.hasAuthToken) {
      issues.push({
        severity: 'CRITICAL',
        component: 'Authentication',
        issue: 'No authentication token found in localStorage',
      })
    }
    console.log('')

    // Check environment configuration
    console.log('🔍 CHECKING ENVIRONMENT CONFIGURATION')
    console.log('-'.repeat(70))

    const envCheck = await page.evaluate(() => {
      // Try to find any exposed config
      return {
        hasSupabaseConfig: typeof window !== 'undefined',
        hostname: window.location.hostname,
        origin: window.location.origin,
      }
    })

    console.log(`Hostname: ${envCheck.hostname}`)
    console.log(`Origin: ${envCheck.origin}`)
    console.log('')

    // Summary of all failed requests
    if (failedRequests.length > 0) {
      console.log('🔍 ALL FAILED REQUESTS SUMMARY')
      console.log('-'.repeat(70))
      const uniqueUrls = [...new Set(failedRequests.map((r) => r.url))]
      uniqueUrls.forEach((url) => {
        const requests = failedRequests.filter((r) => r.url === url)
        console.log(`❌ ${url}`)
        console.log(
          `   Status: ${requests[0].status}, Count: ${requests.length}`
        )
      })
      console.log('')
    }
  } catch (error) {
    console.log('\n❌ FATAL ERROR:', error.message)
    issues.push({
      severity: 'CRITICAL',
      component: 'Test Execution',
      issue: error.message,
    })
  } finally {
    await browser.close()
  }

  // Final Report
  console.log('\n' + '='.repeat(70))
  console.log('📊 DIAGNOSIS REPORT')
  console.log('='.repeat(70))

  if (issues.length === 0) {
    console.log('✅ No critical issues found')
  } else {
    console.log(`\n🚨 Found ${issues.length} issue(s):\n`)

    const critical = issues.filter((i) => i.severity === 'CRITICAL')
    const high = issues.filter((i) => i.severity === 'HIGH')
    const medium = issues.filter((i) => i.severity === 'MEDIUM')

    if (critical.length > 0) {
      console.log('❌ CRITICAL ISSUES:')
      critical.forEach((issue, i) => {
        console.log(`\n${i + 1}. [${issue.component}]`)
        console.log(`   ${issue.issue}`)
      })
    }

    if (high.length > 0) {
      console.log('\n⚠️  HIGH PRIORITY ISSUES:')
      high.forEach((issue, i) => {
        console.log(`\n${i + 1}. [${issue.component}]`)
        console.log(`   ${issue.issue}`)
      })
    }

    if (medium.length > 0) {
      console.log('\n⚠️  MEDIUM PRIORITY ISSUES:')
      medium.forEach((issue, i) => {
        console.log(`\n${i + 1}. [${issue.component}]`)
        console.log(`   ${issue.issue}`)
      })
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('🔧 RECOMMENDED ACTIONS:')
  console.log('='.repeat(70))

  if (issues.some((i) => i.component === 'Edge Functions')) {
    console.log('\n1. ⚠️  Edge Functions Connectivity Issue')
    console.log('   - Check if edge functions are deployed correctly')
    console.log('   - Verify Supabase project URL is correct')
    console.log('   - Check CORS configuration on Supabase')
    console.log('   - Verify edge function invoke permissions')
  }

  if (issues.some((i) => i.component === 'Navigation')) {
    console.log('\n2. ⚠️  Navigation Menu Issue')
    console.log('   - Check if user has proper role/permissions')
    console.log('   - Verify RLS policies for organizations')
    console.log('   - Check if navigation component is rendering correctly')
  }

  if (issues.some((i) => i.component === 'Devices API')) {
    console.log('\n3. ⚠️  Devices API Issue')
    console.log('   - Verify devices edge function is deployed')
    console.log('   - Check RLS policies on devices table')
    console.log('   - Verify user has access to organization devices')
  }

  if (issues.some((i) => i.component === 'Authentication')) {
    console.log('\n4. ⚠️  Authentication Issue')
    console.log('   - Check authentication token storage')
    console.log('   - Verify session is persisting correctly')
    console.log('   - Check Supabase auth configuration')
  }

  console.log('\n' + '='.repeat(70))
}

diagnoseProduction().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
