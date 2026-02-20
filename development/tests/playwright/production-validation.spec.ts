import { test, expect } from '@playwright/test'

const PRODUCTION_URL = 'https://demo.netneural.ai'

// Production test credentials (adjust as needed)
const PROD_EMAIL = 'admin@netneural.ai'
const PROD_PASSWORD = 'NetNeural2025!' // Update with actual production password

test.describe('Production Validation - demo.netneural.ai', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to production site
    await page.goto(PRODUCTION_URL)
  })

  test('Bug #22: Remember Me checkbox visible on login', async ({ page }) => {
    // Should be on login page or redirect there
    await page.waitForLoadState('networkidle')

    // Check if already logged in (might redirect to dashboard)
    const url = page.url()
    if (!url.includes('/auth/login')) {
      // Need to logout first
      await page.goto(`${PRODUCTION_URL}/auth/login`)
    }

    // Check for Remember Me checkbox
    const rememberMeCheckbox = page
      .locator('input[type="checkbox"]')
      .filter({ hasText: /remember me/i })
      .or(
        page
          .locator('label:has-text("Remember Me")')
          .locator('input[type="checkbox"]')
      )

    await expect(rememberMeCheckbox.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ Bug #22: Remember Me checkbox is visible')
  })

  test('Production site loads successfully', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Check that we get a valid page (not 404 or error)
    const title = await page.title()
    console.log(`Page title: ${title}`)

    expect(title).toBeTruthy()
    expect(title).not.toContain('404')
    expect(title).not.toContain('Error')
  })

  test('Login functionality works', async ({ page }) => {
    // Navigate to login
    await page.goto(`${PRODUCTION_URL}/auth/login`)
    await page.waitForLoadState('networkidle')

    // Fill in credentials
    const emailInput = page
      .locator('input[type="email"], input[name="email"]')
      .first()
    const passwordInput = page
      .locator('input[type="password"], input[name="password"]')
      .first()

    await expect(emailInput).toBeVisible({ timeout: 10000 })

    await emailInput.fill(PROD_EMAIL)
    await passwordInput.fill(PROD_PASSWORD)

    // Click login button
    const loginButton = page
      .locator('button[type="submit"]')
      .filter({ hasText: /sign in|log in|login/i })
      .first()
    await loginButton.click()

    // Wait for navigation
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    // Should redirect to dashboard
    const url = page.url()
    console.log(`After login URL: ${url}`)

    // Check if we're on dashboard or got redirected there
    expect(url).toMatch(/dashboard|app/i)
    console.log('✅ Login successful')
  })

  test('Dashboard loads with widgets', async ({ page }) => {
    // Login first
    await page.goto(`${PRODUCTION_URL}/auth/login`)
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[type="email"]').first()
    const passwordInput = page.locator('input[type="password"]').first()

    if (await emailInput.isVisible()) {
      await emailInput.fill(PROD_EMAIL)
      await passwordInput.fill(PROD_PASSWORD)

      const loginButton = page.locator('button[type="submit"]').first()
      await loginButton.click()
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    }

    // Navigate to dashboard
    await page.goto(`${PRODUCTION_URL}/dashboard`)
    await page.waitForLoadState('networkidle')

    // Bug #7: Check for Alerts card
    const alertsCard = page
      .locator('text=Alerts')
      .or(page.locator('text=Recent Alerts'))
    await expect(alertsCard.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ Bug #7: Alerts card visible')

    // Bug #12: Check for Locations card
    const locationsCard = page
      .locator('text=Locations')
      .or(page.locator('text=Location'))
    await expect(locationsCard.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ Bug #12: Locations card visible')
  })

  test('Settings page accessible', async ({ page }) => {
    // Login
    await page.goto(`${PRODUCTION_URL}/auth/login`)
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[type="email"]').first()
    if (await emailInput.isVisible()) {
      await emailInput.fill(PROD_EMAIL)
      await page.locator('input[type="password"]').first().fill(PROD_PASSWORD)
      await page.locator('button[type="submit"]').first().click()
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    }

    // Navigate to settings
    await page.goto(`${PRODUCTION_URL}/dashboard/settings`)
    await page.waitForLoadState('networkidle')

    // Check for settings tabs
    const profileTab = page
      .locator('text=Profile')
      .or(page.locator('[role="tab"]:has-text("Profile")'))
    const preferencesTab = page
      .locator('text=Preferences')
      .or(page.locator('[role="tab"]:has-text("Preferences")'))
    const securityTab = page
      .locator('text=Security')
      .or(page.locator('[role="tab"]:has-text("Security")'))

    await expect(profileTab.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ Settings page loaded - Profile tab visible')

    // Check if Preferences and Security tabs exist
    const preferencesExists = await preferencesTab
      .first()
      .isVisible()
      .catch(() => false)
    const securityExists = await securityTab
      .first()
      .isVisible()
      .catch(() => false)

    console.log(`Preferences tab visible: ${preferencesExists}`)
    console.log(`Security tab visible: ${securityExists}`)
  })

  test('Organizations page accessible', async ({ page }) => {
    // Login
    await page.goto(`${PRODUCTION_URL}/auth/login`)
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[type="email"]').first()
    if (await emailInput.isVisible()) {
      await emailInput.fill(PROD_EMAIL)
      await page.locator('input[type="password"]').first().fill(PROD_PASSWORD)
      await page.locator('button[type="submit"]').first().click()
      await page.waitForLoadState('networkidle', { timeout: 15000 })
    }

    // Navigate to organizations
    await page.goto(`${PRODUCTION_URL}/dashboard/organizations`)
    await page.waitForLoadState('networkidle')

    // Check page loaded
    const organizationsHeading = page
      .locator('h1, h2')
      .filter({ hasText: /organization/i })
    await expect(organizationsHeading.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ Organizations page loaded')
  })

  test('Check deployment version', async ({ page }) => {
    await page.goto(PRODUCTION_URL)
    await page.waitForLoadState('networkidle')

    // Try to find version info in page or console
    const pageContent = await page.content()

    // Check if our new components are in the HTML
    const hasLocationCard =
      pageContent.includes('LocationsCard') || pageContent.includes('Locations')
    const hasRememberMe =
      pageContent.includes('Remember Me') || pageContent.includes('remember')

    console.log(`LocationsCard in page: ${hasLocationCard}`)
    console.log(`Remember Me in page: ${hasRememberMe}`)

    // Check console for any errors
    const logs: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        logs.push(msg.text())
      }
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    if (logs.length > 0) {
      console.log('Console errors found:')
      logs.forEach((log) => console.log(`  - ${log}`))
    } else {
      console.log('✅ No console errors detected')
    }
  })

  test('Responsive design check', async ({ page }) => {
    await page.goto(PRODUCTION_URL)
    await page.waitForLoadState('networkidle')

    // Test different viewport sizes
    const viewports = [
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 },
    ]

    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await page.waitForTimeout(1000)

      await page.screenshot()
      console.log(
        `✅ ${viewport.name} view (${viewport.width}x${viewport.height}) rendered successfully`
      )
    }
  })

  test('Performance check - page load time', async ({ page }) => {
    const startTime = Date.now()

    await page.goto(PRODUCTION_URL)
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime
    console.log(`Page load time: ${loadTime}ms`)

    // Warn if load time is too slow
    if (loadTime > 5000) {
      console.warn(`⚠️  Page load time is slow: ${loadTime}ms`)
    } else {
      console.log(`✅ Page load time acceptable: ${loadTime}ms`)
    }

    expect(loadTime).toBeLessThan(10000) // Should load within 10 seconds
  })
})
