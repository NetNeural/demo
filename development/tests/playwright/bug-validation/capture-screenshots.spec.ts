import { test } from '@playwright/test'

const BASE_URL = 'http://localhost:3003'
const TEST_EMAIL = 'superadmin@netneural.ai'
const TEST_PASSWORD = 'SuperSecure123!'

test.describe('Bug Fix Screenshots', () => {
  test('Capture all bug fix screenshots', async ({ page }) => {
    // Set viewport for consistent screenshots
    await page.setViewportSize({ width: 1920, height: 1080 })

    // 1. Bug #22: Remember Me Checkbox on Login Page
    await page.goto(`${BASE_URL}/auth/login`)
    await page.screenshot({
      path: 'screenshots/bug-22-remember-me.png',
      fullPage: true,
    })

    // Login to access dashboard features
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')

    // Wait for navigation
    await page.waitForTimeout(3000)

    // 2. Bug #7 & #12: Dashboard with Alerts and Locations
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForTimeout(2000)
    await page.screenshot({
      path: 'screenshots/bug-07-12-dashboard-alerts-locations.png',
      fullPage: true,
    })

    // 3. Navigate to Settings - Profile Tab (Bug #11, #8-10)
    await page.goto(`${BASE_URL}/dashboard/settings`)
    await page.waitForTimeout(2000)
    await page.screenshot({
      path: 'screenshots/bug-11-profile-save.png',
      fullPage: true,
    })

    // 4. Switch to Preferences Tab (Bug #13, #16, #14-15, #17)
    await page.click('button:has-text("Preferences")')
    await page.waitForTimeout(1000)
    await page.screenshot({
      path: 'screenshots/bug-13-16-preferences-theme.png',
      fullPage: true,
    })

    // 5. Switch to Security Tab (Bug #18, #20, #21, #19)
    await page.click('button:has-text("Security")')
    await page.waitForTimeout(1000)
    await page.screenshot({
      path: 'screenshots/bug-18-20-21-security.png',
      fullPage: true,
    })

    // Scroll down to see 2FA section (Bug #19)
    await page.evaluate(() => window.scrollTo(0, 800))
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'screenshots/bug-19-2fa-section.png',
      fullPage: false,
    })

    // 6. Navigate to Organizations (Bug #1-6)
    await page.goto(`${BASE_URL}/dashboard/organizations`)
    await page.waitForTimeout(2000)

    // Click on first organization if available
    const orgCard = page.locator('[class*="cursor-pointer"]').first()
    if (await orgCard.isVisible()) {
      await orgCard.click()
      await page.waitForTimeout(2000)
      await page.screenshot({
        path: 'screenshots/bug-06-organization-settings.png',
        fullPage: true,
      })

      // 7. Organization Devices Tab (Bug #1)
      await page.click('button:has-text("Devices")')
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: 'screenshots/bug-01-add-device-button.png',
        fullPage: true,
      })

      // 8. Organization Members Tab (Bug #2)
      await page.click('button:has-text("Members")')
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: 'screenshots/bug-02-add-member-button.png',
        fullPage: true,
      })

      // 9. Organization Locations Tab (Bug #3)
      await page.click('button:has-text("Locations")')
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: 'screenshots/bug-03-add-location-button.png',
        fullPage: true,
      })

      // 10. Organization Integrations Tab (Bug #4)
      await page.click('button:has-text("Integrations")')
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: 'screenshots/bug-04-add-integration-button.png',
        fullPage: true,
      })

      // 11. Organization Alerts Tab (Bug #5)
      await page.click('button:has-text("Alerts")')
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: 'screenshots/bug-05-view-alerts-button.png',
        fullPage: true,
      })
    }

    console.log('✅ All screenshots captured successfully!')
  })
})
