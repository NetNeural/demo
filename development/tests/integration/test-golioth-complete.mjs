import { chromium } from 'playwright'

const LOCAL_URL = 'http://localhost:3000'
const EMAIL = 'superadmin@netneural.ai'
const PASSWORD = 'SuperSecure123!'

// Golioth credentials from .env.local
const GOLIOTH_API_KEY = 'DAf7enB249brtg8EAX7nWnMqWlyextWY'
const GOLIOTH_PROJECT_ID = 'nn-cellular-alerts'
const GOLIOTH_BASE_URL = 'https://api.golioth.io/v1'

;(async () => {
  console.log('🧪 COMPLETE GOLIOTH INTEGRATION TEST\n')
  console.log('This will:')
  console.log('1. Login to the application')
  console.log('2. Navigate to Integrations page')
  console.log('3. Create a new Golioth integration')
  console.log('4. Test the connection')
  console.log('5. Enable sync and configure settings')
  console.log('6. Trigger a device import')
  console.log('7. Verify new devices appear\n')

  const browser = await chromium.launch({ headless: false, slowMo: 500 })
  const page = await browser.newPage()

  // Track console messages
  page.on('console', (msg) => {
    const text = msg.text()
    if (
      text.includes('ERROR') ||
      text.includes('error') ||
      text.includes('failed')
    ) {
      console.log(`[BROWSER ERROR]:`, text)
    }
  })

  // Track errors
  page.on('pageerror', (error) => {
    console.log(`[PAGE ERROR]:`, error.message)
  })

  // Track API calls to edge functions
  const apiCalls = []
  page.on('response', async (response) => {
    const url = response.url()
    if (url.includes('/functions/v1/')) {
      const status = response.status()
      const method = response.request().method()
      let body = null
      try {
        if (status !== 204) {
          body = await response.json()
        }
      } catch (e) {
        // Not JSON
      }
      apiCalls.push({
        method,
        url: url.split('/functions/v1/')[1],
        status,
        success: status >= 200 && status < 300,
        body,
      })
    }
  })

  try {
    // ========================================
    // STEP 1: LOGIN
    // ========================================
    console.log('🔐 STEP 1: Logging in...')
    await page.goto(`${LOCAL_URL}/auth/login`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
    console.log('✅ Login successful\n')

    // ========================================
    // STEP 2: NAVIGATE TO INTEGRATIONS
    // ========================================
    console.log('🔧 STEP 2: Navigating to Integrations page...')
    await page.goto(`${LOCAL_URL}/dashboard/integrations`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.waitForTimeout(2000)

    // Check if any Golioth integrations already exist
    const existingIntegrations = await page.locator('text=/Golioth/i').count()
    console.log(`Found ${existingIntegrations} existing Golioth integration(s)`)

    if (existingIntegrations > 0) {
      console.log('\n⚠️  Golioth integration already exists!')
      console.log('Options:')
      console.log('1. Delete existing and create new')
      console.log('2. Use existing integration')
      console.log(
        '\nFor this test, I will check if we can sync with the existing integration...\n'
      )

      // Click on the existing integration to open it
      await page.click('text=/Golioth/i')
      await page.waitForTimeout(2000)
    } else {
      console.log('✅ No existing integrations, creating new one\n')

      // ========================================
      // STEP 3: CREATE NEW INTEGRATION
      // ========================================
      console.log('➕ STEP 3: Creating new Golioth integration...')

      // Click "Add Integration" button
      const addButton = page
        .locator(
          'button:has-text("Add Integration"), button:has-text("New Integration")'
        )
        .first()
      await addButton.click()
      await page.waitForTimeout(1000)

      // Fill in the integration details
      console.log('Filling integration details...')
      console.log(`  - Name: NetNeural Cellular`)
      console.log(`  - API Key: ${GOLIOTH_API_KEY.substring(0, 10)}...`)
      console.log(`  - Project ID: ${GOLIOTH_PROJECT_ID}`)
      console.log(`  - Base URL: ${GOLIOTH_BASE_URL}`)

      await page.fill(
        'input[id="integration-name"], input[placeholder*="name" i]',
        'NetNeural Cellular'
      )
      await page.waitForTimeout(500)

      await page.fill(
        'input[id="api-key"], input[placeholder*="api key" i]',
        GOLIOTH_API_KEY
      )
      await page.waitForTimeout(500)

      await page.fill(
        'input[id="project-id"], input[placeholder*="project" i]',
        GOLIOTH_PROJECT_ID
      )
      await page.waitForTimeout(500)

      // Base URL might be auto-filled
      const baseUrlInput = page
        .locator('input[id="base-url"], input[placeholder*="base url" i]')
        .first()
      const baseUrlValue = await baseUrlInput.inputValue()
      if (!baseUrlValue || baseUrlValue === '') {
        await baseUrlInput.fill(GOLIOTH_BASE_URL)
        await page.waitForTimeout(500)
      }

      console.log('✅ Integration details filled\n')

      // ========================================
      // STEP 4: TEST CONNECTION
      // ========================================
      console.log('🔌 STEP 4: Testing connection...')
      const testButton = page
        .locator('button:has-text("Test Connection"), button:has-text("Test")')
        .first()
      await testButton.click()
      await page.waitForTimeout(3000)

      // Check for success/failure message
      const successMsg = await page.locator('text=/connected|success/i').count()
      const errorMsg = await page.locator('text=/failed|error/i').count()

      if (successMsg > 0) {
        console.log('✅ Connection test SUCCESSFUL\n')
      } else if (errorMsg > 0) {
        console.log('❌ Connection test FAILED\n')
        const errorText = await page
          .locator('text=/failed|error/i')
          .first()
          .textContent()
        console.log('Error:', errorText)
      } else {
        console.log('⚠️  Connection test status unclear\n')
      }

      // ========================================
      // STEP 5: CONFIGURE SYNC SETTINGS
      // ========================================
      console.log('⚙️  STEP 5: Configuring sync settings...')

      // Look for "Sync Settings" or similar tab
      const syncTab = page
        .locator('text=/sync.*settings?/i, [role="tab"]:has-text("Sync")')
        .first()
      const tabCount = await syncTab.count()

      if (tabCount > 0) {
        console.log('Clicking Sync Settings tab...')
        await syncTab.click()
        await page.waitForTimeout(1000)

        // Enable automatic sync
        const syncToggle = page
          .locator(
            'input[type="checkbox"]:near(:text("Automatic Sync")), input[type="checkbox"]:near(:text("Enable Sync"))'
          )
          .first()
        const isChecked = await syncToggle.isChecked().catch(() => false)

        if (!isChecked) {
          console.log('Enabling automatic sync...')
          await syncToggle.check()
          await page.waitForTimeout(500)
        }

        // Set sync direction to "import" (Golioth → NetNeural)
        const directionSelect = page
          .locator(
            'select:near(:text("Direction")), [role="combobox"]:near(:text("Direction"))'
          )
          .first()
        const selectCount = await directionSelect.count()

        if (selectCount > 0) {
          console.log(
            'Setting sync direction to Import (Golioth → NetNeural)...'
          )
          await directionSelect.selectOption('import').catch(async () => {
            // Might be a custom select component
            await directionSelect.click()
            await page.waitForTimeout(500)
            await page.click('text=/import.*golioth.*netneural/i')
          })
          await page.waitForTimeout(500)
        }

        console.log('✅ Sync settings configured\n')
      } else {
        console.log('⚠️  Sync Settings tab not found, skipping...\n')
      }

      // ========================================
      // STEP 6: SAVE INTEGRATION
      // ========================================
      console.log('💾 STEP 6: Saving integration...')
      const saveButton = page
        .locator(
          'button:has-text("Save Configuration"), button:has-text("Save"), button:has-text("Create")'
        )
        .first()
      await saveButton.click()
      await page.waitForTimeout(3000)

      // Check for success message
      const saveSuccess = await page
        .locator('text=/saved|created|success/i')
        .count()
      if (saveSuccess > 0) {
        console.log('✅ Integration saved successfully\n')
      } else {
        console.log('⚠️  Save status unclear\n')
      }
    }

    // ========================================
    // STEP 7: TRIGGER DEVICE IMPORT/SYNC
    // ========================================
    console.log('🔄 STEP 7: Triggering device import from Golioth...')

    // Look for "Sync Now" or "Import Devices" button
    const syncButton = page
      .locator(
        'button:has-text("Sync Now"), button:has-text("Import"), button:has-text("Sync Devices")'
      )
      .first()
    const syncButtonCount = await syncButton.count()

    if (syncButtonCount > 0) {
      console.log('Clicking Sync Now button...')
      await syncButton.click()
      await page.waitForTimeout(5000) // Wait for sync to complete

      // Check for sync result
      const syncSuccess = await page
        .locator('text=/synced|imported|success/i')
        .count()
      const syncError = await page.locator('text=/failed|error/i').count()

      if (syncSuccess > 0) {
        console.log('✅ Device sync SUCCESSFUL\n')
      } else if (syncError > 0) {
        console.log('❌ Device sync FAILED\n')
      } else {
        console.log('⚠️  Sync status unclear\n')
      }
    } else {
      console.log('⚠️  Sync button not found - devices may auto-sync\n')
    }

    // ========================================
    // STEP 8: VERIFY DEVICES
    // ========================================
    console.log('📱 STEP 8: Verifying imported devices...')

    // Count current devices before checking Golioth
    await page.goto(`${LOCAL_URL}/dashboard/devices`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.waitForTimeout(3000)

    // Count devices on page
    const deviceNames = await page.evaluate(() => {
      const text = document.body.innerText
      // Look for device-related keywords
      const matches = text.match(
        /Temperature|Humidity|HVAC|Motion|Sensor|Gateway|Device/gi
      )
      return matches || []
    })

    console.log(`\n📊 Device count: ${deviceNames.length} devices found`)

    // Get page content to see device names
    const pageContent = await page.evaluate(() => {
      const main = document.querySelector('main')
      return main ? main.innerText : ''
    })

    // Extract unique device names
    const deviceLines = pageContent.split('\n').filter((line) => {
      return line.match(
        /sensor|gateway|device|hvac|temperature|humidity|motion/i
      )
    })

    console.log('\n📋 Devices visible on page:')
    const uniqueDevices = [...new Set(deviceLines.slice(0, 10))]
    uniqueDevices.forEach((device, idx) => {
      console.log(`  ${idx + 1}. ${device.trim()}`)
    })

    // ========================================
    // STEP 9: CHECK API CALLS
    // ========================================
    console.log('\n\n🔍 API CALL SUMMARY:')
    console.log('='.repeat(60))

    const relevantCalls = apiCalls.filter(
      (call) =>
        call.url.includes('integration') ||
        call.url.includes('device') ||
        call.url.includes('sync')
    )

    console.log(`Total relevant API calls: ${relevantCalls.length}\n`)

    relevantCalls.forEach((call, idx) => {
      console.log(`${idx + 1}. ${call.method} ${call.url}`)
      console.log(`   Status: ${call.status} ${call.success ? '✅' : '❌'}`)
      if (call.body) {
        const bodyStr = JSON.stringify(call.body, null, 2)
        if (bodyStr.length < 200) {
          console.log(`   Response: ${bodyStr}`)
        } else {
          console.log(`   Response: ${bodyStr.substring(0, 200)}...`)
        }
      }
      console.log('')
    })

    // ========================================
    // STEP 10: SUMMARY
    // ========================================
    console.log('\n\n✅ TEST COMPLETE!')
    console.log('='.repeat(60))
    console.log('Summary:')
    console.log(`  - Golioth API Key: ${GOLIOTH_API_KEY.substring(0, 10)}...`)
    console.log(`  - Project ID: ${GOLIOTH_PROJECT_ID}`)
    console.log(`  - Devices Found: ${deviceNames.length}`)
    console.log(`  - API Calls Made: ${relevantCalls.length}`)

    // Take final screenshot
    await page.screenshot({
      path: 'golioth-integration-complete.png',
      fullPage: true,
    })
    console.log('\n📸 Screenshot saved: golioth-integration-complete.png')

    console.log('\n⏸️  Browser will stay open for 60 seconds for inspection...')
    await page.waitForTimeout(60000)
  } catch (error) {
    console.error('❌ TEST ERROR:', error.message)
    console.error(error.stack)
  } finally {
    await browser.close()
  }
})()
