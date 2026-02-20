import { chromium } from 'playwright'

const PRODUCTION_URL = 'https://demo.netneural.ai'
const TEST_EMAIL = 'kaidream78@gmail.com'
const TEST_PASSWORD = 'Welcome2NetNeural!'

async function testWithCorrectOrg() {
  console.log('🔍 TESTING WITH TES ORG (the one with devices)\n')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    // Login
    console.log('🔐 Logging in...')
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 15000 })
    console.log('✅ Login successful\n')

    await page.waitForTimeout(2000)

    // Switch to Tes Org
    console.log('🔄 Switching to "Tes Org" organization...')
    try {
      // Click organization switcher
      const orgButton = page.locator('button:has-text("NetNeural")').first()
      await orgButton.click()
      await page.waitForTimeout(500)

      // Click "Tes Org"
      const tesOrg = page.locator('text="Tes Org"').first()
      await tesOrg.click()
      await page.waitForTimeout(2000)
      console.log('✅ Switched to Tes Org\n')
    } catch (error) {
      console.log('❌ Could not switch organization:', error.message)
      console.log('Continuing with current org...\n')
    }

    // Navigate to Devices
    console.log('📱 Navigating to Devices page...')
    await page.click('a[href="/dashboard/devices"]')
    await page.waitForURL('**/devices**')
    await page.waitForTimeout(3000)
    console.log('✅ Devices page loaded\n')

    // Check devices
    const deviceInfo = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr')
      const devices = []
      rows.forEach((row) => {
        const cells = row.querySelectorAll('td')
        if (cells.length > 0) {
          devices.push({
            name: cells[0]?.textContent?.trim() || '',
            status: cells[1]?.textContent?.trim() || '',
          })
        }
      })
      return {
        count: rows.length,
        devices: devices,
      }
    })

    console.log('📊 DEVICES FOUND:')
    console.log(`  Total: ${deviceInfo.count}`)
    if (deviceInfo.count > 0) {
      console.log('\n  Devices:')
      deviceInfo.devices.forEach((device, i) => {
        console.log(`    ${i + 1}. ${device.name} - ${device.status}`)
      })
    } else {
      console.log('  ❌ No devices displayed')
    }

    // Take screenshot
    await page.screenshot({ path: 'tes-org-devices.png', fullPage: true })
    console.log('\n📸 Screenshot saved: tes-org-devices.png')

    if (deviceInfo.count > 0) {
      console.log(
        '\n✅✅✅ SUCCESS! Production is working correctly with Tes Org!'
      )
    } else {
      console.log(
        '\n❌ Still no devices - may need to check RLS policies or organization switch failed'
      )
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    await page.screenshot({ path: 'error-tes-org.png' })
  } finally {
    await browser.close()
  }
}

testWithCorrectOrg()
