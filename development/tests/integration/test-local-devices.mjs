import { chromium } from 'playwright'

const LOCAL_URL = 'http://localhost:3000'
const EMAIL = 'superadmin@netneural.ai'
const PASSWORD = 'admin123'

;(async () => {
  console.log('🧪 TESTING LOCAL DEVICES API\n')

  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  // Track API responses
  const apiResponses = []
  const allRequests = []
  page.on('response', async (response) => {
    const url = response.url()
    allRequests.push(url)
    if (
      url.includes('/functions/v1/devices') ||
      url.includes('/rest/v1/devices')
    ) {
      try {
        const body = await response.json()
        apiResponses.push({
          url: url,
          status: response.status(),
          body: body,
        })
      } catch (e) {
        apiResponses.push({
          url: url,
          status: response.status(),
          body: 'Could not parse JSON',
        })
      }
    }
  })

  try {
    // Login
    console.log('🔐 Logging in to local...')
    await page.goto(`${LOCAL_URL}/auth/login`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
    console.log('✅ Login successful\n')

    // Go to devices page
    console.log('📱 Navigating to devices page...')
    await page.goto(`${LOCAL_URL}/dashboard/devices`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.waitForTimeout(2000)

    if (apiResponses.length > 0) {
      const resp = apiResponses[apiResponses.length - 1]
      console.log('📡 DEVICES API RESPONSE:')
      console.log(`  Status: ${resp.status}`)
      console.log(`  URL: ${resp.url}`)
      console.log('\n  Response Body:')
      console.log(JSON.stringify(resp.body, null, 2))

      // Check if we got devices
      if (resp.body.success && resp.body.data) {
        const devices = resp.body.data.devices || []
        console.log(`\n✅ Got ${devices.length} device(s)`)

        if (devices.length > 0) {
          const device = devices[0]
          console.log('\n📋 First Device Fields:')
          console.log('  - id:', device.id ? '✓' : '✗')
          console.log('  - name:', device.name ? '✓' : '✗')
          console.log('  - device_type:', device.device_type ? '✓' : '✗')
          console.log('  - type:', device.type ? '✓' : '✗')
          console.log('  - status:', device.status ? '✓' : '✗')
          console.log('  - location:', device.location ? '✓' : '✗')
          console.log('  - lastSeen:', device.lastSeen ? '✓' : '✗')
          console.log(
            '  - batteryLevel:',
            device.batteryLevel !== undefined ? '✓' : '✗'
          )
          console.log(
            '  - isExternallyManaged:',
            device.isExternallyManaged !== undefined ? '✓' : '✗'
          )
        }
      } else {
        console.log('\n❌ API returned error or no data')
      }
    } else {
      console.log('❌ No API responses captured')
      console.log(`\n🌐 Total HTTP requests: ${allRequests.length}`)
      const relevantRequests = allRequests.filter(
        (u) =>
          u.includes('devices') ||
          u.includes('functions') ||
          u.includes('dashboard')
      )
      if (relevantRequests.length > 0) {
        console.log('Relevant requests:', relevantRequests.slice(0, 10))
      }
    }

    // Check UI
    await page.waitForTimeout(1000)
    const deviceCards = await page.locator('[class*="Card"]').count()
    console.log(`\n🎨 UI State:`)
    console.log(`  Device cards visible: ${deviceCards}`)

    // Take screenshot
    await page.screenshot({ path: 'local-devices-test.png', fullPage: true })
    console.log('\n📸 Screenshot saved: local-devices-test.png')
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await browser.close()
  }
})()
