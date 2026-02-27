/**
 * Bug Fix Screenshot Capture
 * Updated 2026-02-27 - uses baseURL from playwright config, correct selectors.
 * Settings tabs are role="tab", Remember Me is #remember-me Radix checkbox.
 */
import { test } from '@playwright/test'

const TEST_EMAIL = 'admin@netneural.ai'
const TEST_PASSWORD = 'password123'

test.describe('Bug Fix Screenshots', () => {
  test('Capture all bug fix screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })

    // 1. Bug #22: Remember Me Checkbox on Login Page
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: 'screenshots/bug-22-remember-me.png',
      fullPage: true,
    })

    // Login
    await page.locator('#email').fill(TEST_EMAIL)
    await page.locator('#password').fill(TEST_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/dashboard**', { timeout: 15000 })

    // 2. Bug #7 & #12: Dashboard with Alerts and System Health
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({
      path: 'screenshots/bug-07-12-dashboard-alerts-locations.png',
      fullPage: true,
    })

    // 3. Settings - Profile Tab (Bug #11)
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({
      path: 'screenshots/bug-11-profile-save.png',
      fullPage: true,
    })

    // 4. Settings - Preferences Tab (Bug #13, #16)
    const preferencesTab = page.getByRole('tab', { name: /preferences/i })
    await preferencesTab.click()
    await page.waitForTimeout(1000)
    await page.screenshot({
      path: 'screenshots/bug-13-16-preferences-theme.png',
      fullPage: true,
    })

    // 5. Settings - Security Tab (Bug #18, #20, #21)
    const securityTab = page.getByRole('tab', { name: /security/i })
    await securityTab.click()
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

    // 6. Organizations page
    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({
      path: 'screenshots/bug-06-organization-settings.png',
      fullPage: true,
    })

    // 7. Devices page
    await page.goto('/dashboard/devices')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({
      path: 'screenshots/devices-list.png',
      fullPage: true,
    })

    // 8. Alerts page
    await page.goto('/dashboard/alerts')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({
      path: 'screenshots/alerts-page.png',
      fullPage: true,
    })

    console.log('✅ All screenshots captured successfully!')
  })
})
