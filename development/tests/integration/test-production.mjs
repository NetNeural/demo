import { chromium } from 'playwright'

const PRODUCTION_URL = 'https://demo.netneural.ai'
const TEST_EMAIL = 'kaidream78@gmail.com'
const TEST_PASSWORD = 'Welcome2NetNeural!'

async function testProduction() {
  console.log('🚀 Starting Production Test - demo.netneural.ai\n')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  })
  const page = await context.newPage()

  const issues = []

  // Listen for console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text())
      issues.push({ type: 'Console Error', message: msg.text() })
    }
  })

  // Listen for page errors
  page.on('pageerror', (error) => {
    console.log('❌ Page Error:', error.message)
    issues.push({ type: 'Page Error', message: error.message })
  })

  // Listen for failed requests
  page.on('response', (response) => {
    if (response.status() >= 400) {
      console.log(`❌ Failed Request: ${response.status()} ${response.url()}`)
      issues.push({
        type: 'Failed Request',
        status: response.status(),
        url: response.url(),
      })
    }
  })

  try {
    // Test 1: Load login page
    console.log('📝 Test 1: Loading login page...')
    await page.goto(PRODUCTION_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    console.log('✅ Login page loaded\n')

    // Test 2: Login
    console.log('📝 Test 2: Attempting login...')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')

    // Wait for navigation
    await page.waitForURL('**/dashboard**', { timeout: 15000 })
    console.log('✅ Login successful\n')

    // Test 3: Dashboard
    console.log('📝 Test 3: Testing Dashboard page...')
    await page.waitForSelector('text=Dashboard', { timeout: 10000 })
    const dashboardTitle = await page.textContent('h1, h2')
    console.log(`   Dashboard loaded: "${dashboardTitle}"`)
    console.log('✅ Dashboard page working\n')

    // Test 4: Devices page
    console.log('📝 Test 4: Testing Devices page...')
    await page.click('text=Devices')
    await page.waitForURL('**/devices**', { timeout: 10000 })
    await page.waitForTimeout(2000) // Wait for data to load

    const deviceCount = await page.locator('table tbody tr').count()
    console.log(`   Found ${deviceCount} devices`)

    if (deviceCount === 0) {
      console.log('⚠️  WARNING: No devices found')
      issues.push({ type: 'No Data', message: 'Devices page shows no devices' })
    } else {
      console.log('✅ Devices page working\n')
    }

    // Test 5: Alerts page
    console.log('📝 Test 5: Testing Alerts page...')
    await page.click('text=Alerts')
    await page.waitForURL('**/alerts**', { timeout: 10000 })
    await page.waitForTimeout(2000)

    const alertCount = await page
      .locator('div[role="alert"], .alert-item, table tbody tr')
      .count()
    console.log(`   Found ${alertCount} alerts/alert rows`)
    console.log('✅ Alerts page loaded\n')

    // Test 6: Organizations/Integrations
    console.log('📝 Test 6: Testing Integrations...')
    await page.click('text=Organizations')
    await page.waitForURL('**/organizations**', { timeout: 10000 })
    await page.waitForTimeout(1000)

    // Click Integrations tab
    const integrationsTab = page.locator('text=Integrations').first()
    if (await integrationsTab.isVisible()) {
      await integrationsTab.click()
      await page.waitForTimeout(2000)

      const integrationCards = await page
        .locator('[class*="integration"], [class*="card"]')
        .count()
      console.log(`   Found ${integrationCards} integration cards/elements`)
      console.log('✅ Integrations tab loaded\n')
    } else {
      console.log('⚠️  Integrations tab not found')
      issues.push({
        type: 'Missing Element',
        message: 'Integrations tab not found',
      })
    }

    // Test 7: Settings page
    console.log('📝 Test 7: Testing Settings page...')
    await page.click('text=Settings')
    await page.waitForURL('**/settings**', { timeout: 10000 })
    await page.waitForTimeout(1000)
    console.log('✅ Settings page loaded\n')

    // Take screenshot of current state
    await page.screenshot({
      path: 'production-test-screenshot.png',
      fullPage: false,
    })
    console.log('📸 Screenshot saved: production-test-screenshot.png\n')
  } catch (error) {
    console.log('\n❌ TEST FAILED:', error.message)
    issues.push({ type: 'Test Error', message: error.message })

    // Take error screenshot
    try {
      await page.screenshot({
        path: 'production-error-screenshot.png',
        fullPage: false,
      })
      console.log(
        '📸 Error screenshot saved: production-error-screenshot.png\n'
      )
    } catch (e) {
      console.log('Failed to save error screenshot')
    }
  } finally {
    await browser.close()
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 TEST SUMMARY')
  console.log('='.repeat(60))

  if (issues.length === 0) {
    console.log('✅ All tests passed! Production is working correctly.')
  } else {
    console.log(`⚠️  Found ${issues.length} issue(s):\n`)
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.type}] ${issue.message}`)
      if (issue.status) console.log(`   Status: ${issue.status}`)
      if (issue.url) console.log(`   URL: ${issue.url}`)
      console.log('')
    })
  }

  console.log('='.repeat(60))

  return issues.length === 0
}

testProduction()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
