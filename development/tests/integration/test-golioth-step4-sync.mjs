import { chromium } from 'playwright'

const LOCAL_URL = 'http://localhost:3000'
const EMAIL = 'superadmin@netneural.ai'
const PASSWORD = 'SuperSecure123!'

;(async () => {
  console.log('🔄 STEP 4: Trigger Golioth device sync\n')

  const browser = await chromium.launch({ headless: false, slowMo: 500 })
  const page = await browser.newPage()

  // Track API calls
  const apiCalls = []
  page.on('response', async (response) => {
    const url = response.url()
    if (url.includes('/functions/v1/')) {
      try {
        const body = await response.json()
        apiCalls.push({
          endpoint: url.split('/functions/v1/')[1].split('?')[0],
          status: response.status(),
          success: response.ok,
          body,
        })
      } catch (e) {
        apiCalls.push({
          endpoint: url.split('/functions/v1/')[1].split('?')[0],
          status: response.status(),
          success: response.ok,
        })
      }
    }
  })

  try {
    // Login
    console.log('🔐 Logging in...')
    await page.goto(`${LOCAL_URL}/auth/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
    console.log('✅ Logged in\n')

    // Go to integrations
    console.log('🔧 Opening integrations page...')
    await page.goto(`${LOCAL_URL}/dashboard/integrations`)
    await page.waitForTimeout(2000)

    // Look for Sync Now button
    console.log('🔍 Looking for Sync button...')
    const syncButtonSelectors = [
      'button:has-text("Sync Now")',
      'button:has-text("Sync Devices")',
      'button:has-text("Import")',
      'button:has-text("Import Devices")',
      '[data-testid="sync-button"]',
    ]

    let syncButton = null
    for (const selector of syncButtonSelectors) {
      const count = await page.locator(selector).count()
      if (count > 0) {
        syncButton = page.locator(selector).first()
        console.log(`✅ Found sync button: ${selector}\n`)
        break
      }
    }

    if (syncButton) {
      console.log('🔄 Clicking Sync button...')
      await syncButton.click()
      await page.waitForTimeout(8000) // Wait for sync to complete

      // Check for success/error messages
      const success = await page
        .locator('text=/synced|imported|success|complete/i')
        .count()
      const error = await page.locator('text=/error|failed/i').count()

      if (success > 0) {
        console.log('✅ Sync appears successful!\n')
      } else if (error > 0) {
        console.log('❌ Sync may have failed\n')
      } else {
        console.log('⚠️  Sync status unclear\n')
      }
    } else {
      console.log(
        '⚠️  Sync button not found - checking for Configure option...\n'
      )

      // Try to open the integration config
      const configButton = await page
        .locator('button:has-text("Configure")')
        .count()
      if (configButton > 0) {
        console.log('Opening integration config...')
        await page.click('button:has-text("Configure")')
        await page.waitForTimeout(2000)

        // Look for sync tab or button in dialog
        const syncTab = await page
          .locator(
            '[role="tab"]:has-text("Sync"), button:has-text("Sync Settings")'
          )
          .count()
        if (syncTab > 0) {
          console.log('Found Sync tab, clicking...')
          await page
            .locator(
              '[role="tab"]:has-text("Sync"), button:has-text("Sync Settings")'
            )
            .first()
            .click()
          await page.waitForTimeout(1000)
        }

        // Now look for sync button in dialog
        const dialogSyncButton = await page
          .locator('button:has-text("Sync Now"), button:has-text("Import Now")')
          .count()
        if (dialogSyncButton > 0) {
          console.log('Clicking sync button in dialog...')
          await page.click(
            'button:has-text("Sync Now"), button:has-text("Import Now")'
          )
          await page.waitForTimeout(8000)
        }
      }
    }

    await page.screenshot({ path: 'step4-after-sync.png' })
    console.log('📸 Screenshot: step4-after-sync.png\n')

    // Check API calls
    console.log('📡 API Calls Made:')
    const syncCalls = apiCalls.filter(
      (c) =>
        c.endpoint.includes('sync') ||
        c.endpoint.includes('device-sync') ||
        c.endpoint.includes('integration')
    )

    if (syncCalls.length > 0) {
      syncCalls.forEach((call, idx) => {
        console.log(
          `  ${idx + 1}. ${call.endpoint} - ${call.status} ${call.success ? '✅' : '❌'}`
        )
        if (call.body) {
          if (call.body.devices_succeeded !== undefined) {
            console.log(
              `     → Devices succeeded: ${call.body.devices_succeeded}`
            )
            console.log(`     → Devices failed: ${call.body.devices_failed}`)
          }
          if (call.body.message) {
            console.log(`     → ${call.body.message}`)
          }
        }
      })
    } else {
      console.log('  No sync API calls detected\n')
    }

    console.log('\n⏸️  Keeping browser open for 15 seconds...')
    await page.waitForTimeout(15000)
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await browser.close()
  }
})()
