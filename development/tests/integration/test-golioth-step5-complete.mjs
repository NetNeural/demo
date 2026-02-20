import { chromium } from 'playwright'

const LOCAL_URL = 'http://localhost:3000'
const EMAIL = 'superadmin@netneural.ai'
const PASSWORD = 'SuperSecure123!'
const GOLIOTH_API_KEY = 'DAf7enB249brtg8EAX7nWnMqWlyextWY'
const GOLIOTH_PROJECT_ID = 'nn-cellular-alerts'

;(async () => {
  console.log('✨ STEP 5: Complete integration and import devices\n')

  const browser = await chromium.launch({ headless: false, slowMo: 400 })
  const page = await browser.newPage()

  // Track API responses
  const apiResponses = []
  page.on('response', async (response) => {
    const url = response.url()
    if (
      url.includes('/functions/v1/device-sync') ||
      url.includes('/functions/v1/integrations')
    ) {
      try {
        const body = await response.json()
        apiResponses.push({
          url: url.split('/functions/v1/')[1],
          status: response.status(),
          body,
        })
        console.log(
          `\n📡 API: ${url.split('/functions/v1/')[1]} - ${response.status()}`
        )
        if (body.devices_succeeded !== undefined) {
          console.log(`   ✅ Devices succeeded: ${body.devices_succeeded}`)
          console.log(`   ❌ Devices failed: ${body.devices_failed}`)
        }
        if (body.message) {
          console.log(`   💬 ${body.message}`)
        }
      } catch (e) {
        /* not json */
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

    // Open integrations
    await page.goto(`${LOCAL_URL}/dashboard/integrations`)
    await page.waitForTimeout(2000)

    // Click Configure
    console.log('\n⚙️  Opening integration configuration...')
    await page.click('button:has-text("Configure")')
    await page.waitForTimeout(2000)

    // Fill credentials on General tab
    console.log('📝 Ensuring credentials are set...')
    const apiKeyInput = page.locator('input[id="api-key"]').first()
    await apiKeyInput.fill(GOLIOTH_API_KEY)
    await page.waitForTimeout(300)

    const projectInput = page.locator('input[id="project-id"]').first()
    await projectInput.fill(GOLIOTH_PROJECT_ID)
    await page.waitForTimeout(300)

    // Save first so we have an integrationId
    console.log('\n💾 Saving integration (to enable sync tabs)...')
    await page.click('button:has-text("Save")')
    await page.waitForTimeout(4000)

    console.log('✅ Save clicked, checking result...\n')

    // Close the dialog
    await page.keyboard.press('Escape')
    await page.waitForTimeout(2000)

    // Reopen to configure sync
    console.log('⚙️  Reopening integration to configure sync...')
    await page.click('button:has-text("Configure")')
    await page.waitForTimeout(3000)

    // Click Sync Settings tab (not "Sync" - that's "Run Sync")
    console.log('🔄 Opening Sync Settings tab...')
    await page.click('[role="tab"]:has-text("Sync Settings")')
    await page.waitForTimeout(1500)

    // Enable sync
    console.log('✅ Enabling automatic sync...')
    const syncToggle = page.locator('input[type="checkbox"]').first()
    const isChecked = await syncToggle.isChecked().catch(() => false)
    if (!isChecked) {
      await syncToggle.check()
      await page.waitForTimeout(500)
    }

    // Set direction to import
    console.log('📥 Setting sync direction to Import...')
    const directionSelect = page.locator('select, [role="combobox"]').first()
    try {
      await directionSelect.selectOption({ label: /import/i })
    } catch (e) {
      // Might be a custom select
      await directionSelect.click()
      await page.waitForTimeout(300)
      await page.click('text=/import.*golioth.*netneural/i')
    }
    await page.waitForTimeout(500)

    // Save sync settings
    console.log('\n💾 Saving sync configuration...')
    await page.click('button:has-text("Save")')
    await page.waitForTimeout(4000)
    console.log('✅ Sync settings saved!\n')

    // Now go to "Run Sync" tab to trigger manual sync
    console.log('🚀 Opening Run Sync tab...')
    await page.click('button:has-text("Configure")')
    await page.waitForTimeout(2000)
    await page.click('[role="tab"]:has-text("Run Sync")')
    await page.waitForTimeout(1500)

    // Look for "Sync Now" button
    const syncNowButton = await page
      .locator('button:has-text("Sync Now"), button:has-text("Import Now")')
      .count()
    if (syncNowButton > 0) {
      console.log('Clicking Sync Now button...')
      await page.click(
        'button:has-text("Sync Now"), button:has-text("Import Now")'
      )
      await page.waitForTimeout(8000) // Wait for sync to complete
      console.log('✅ Sync triggered!\n')
    } else {
      console.log('⚠️  Sync Now button not found\n')
    }

    await page.screenshot({ path: 'step5-sync-complete.png' })

    // Close dialog and go to devices page
    console.log('📱 Navigating to devices page to verify...\n')
    await page.keyboard.press('Escape') // Close dialog
    await page.waitForTimeout(1000)

    await page.goto(`${LOCAL_URL}/dashboard/devices`)
    await page.waitForTimeout(4000)

    // Count devices
    const deviceCount = await page.evaluate(() => {
      const text = document.body.innerText
      // Count Golioth device names
      const matches = text.match(
        /C252400001|nn-gateway-01|C253700003|C253700002/gi
      )
      return matches ? matches.length : 0
    })

    console.log(
      `\n📊 Result: Found ${deviceCount} Golioth devices on devices page!`
    )

    if (deviceCount > 0) {
      console.log('\n✅ SUCCESS! Golioth devices imported:\n')
      const pageText = await page.evaluate(
        () => document.querySelector('main')?.innerText || ''
      )
      const lines = pageText.split('\n')
      ;['C252400001', 'nn-gateway-01', 'C253700003', 'C253700002'].forEach(
        (name) => {
          if (pageText.includes(name)) {
            console.log(`   ✓ ${name}`)
          }
        }
      )
    } else {
      console.log(
        '\n⚠️  No Golioth devices found yet - they may take a moment to appear'
      )
    }

    await page.screenshot({ path: 'step5-devices-page.png' })
    console.log('\n📸 Screenshots saved:')
    console.log('   - step5-sync-complete.png')
    console.log('   - step5-devices-page.png')

    console.log('\n⏸️  Keeping browser open for 20 seconds to review...')
    await page.waitForTimeout(20000)
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    await page.screenshot({ path: 'step5-error.png' })
  } finally {
    await browser.close()
  }
})()
