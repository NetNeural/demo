const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 })
  const context = await browser.newContext()
  const page = await context.newPage()

  console.log('\n��� Starting manual bug check...\n')

  try {
    // Login
    console.log('1. Navigating to login page...')
    await page.goto('http://localhost:3004/auth/login/')
    await page.waitForLoadState('networkidle')

    console.log('2. Logging in...')
    await page.fill('input[type="email"]', 'superadmin@netneural.ai')
    await page.fill('input[type="password"]', 'SuperSecure123!')
    await page.click('button[type="submit"]')
    await page.waitForLoadState('networkidle')

    // Dashboard
    console.log('3. Checking dashboard...')
    await page.goto('http://localhost:3004/dashboard/')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'bug-check-dashboard.png', fullPage: true })
    console.log('   ��� Screenshot: bug-check-dashboard.png')

    // Settings - Profile
    console.log('4. Checking settings - profile...')
    await page.goto('http://localhost:3004/dashboard/settings/')
    await page.waitForLoadState('networkidle')
    await page.click('text=Profile')
    await page.waitForTimeout(1000)
    await page.screenshot({
      path: 'bug-check-settings-profile.png',
      fullPage: true,
    })
    console.log('   ��� Screenshot: bug-check-settings-profile.png')

    // Settings - Preferences
    console.log('5. Checking settings - preferences...')
    await page.click('text=Preferences')
    await page.waitForTimeout(1000)
    await page.screenshot({
      path: 'bug-check-settings-preferences.png',
      fullPage: true,
    })
    console.log('   ��� Screenshot: bug-check-settings-preferences.png')

    // Settings - Security
    console.log('6. Checking settings - security...')
    await page.click('text=Security')
    await page.waitForTimeout(1000)
    await page.screenshot({
      path: 'bug-check-settings-security.png',
      fullPage: true,
    })
    console.log('   ��� Screenshot: bug-check-settings-security.png')

    // Organizations
    console.log('7. Checking organizations...')
    await page.goto('http://localhost:3004/dashboard/organizations/')
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: 'bug-check-organizations.png',
      fullPage: true,
    })
    console.log('   ��� Screenshot: bug-check-organizations.png')

    console.log(
      '\n✅ Bug check complete! Review screenshots and browser window.\n'
    )
    console.log('Press Ctrl+C to exit...')

    // Keep browser open for manual inspection
    await page.waitForTimeout(300000) // 5 minutes
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await browser.close()
  }
})()
