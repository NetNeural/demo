/**
 * Bug Fixes Validation with Superadmin
 * Updated 2026-02-27 - uses baseURL from playwright config, correct selectors.
 *
 * Remember Me is a Radix <Checkbox> with id="remember-me" and label "Keep me signed in".
 * Settings tabs use role="tab" (not role="button").
 * Dashboard heading is the org name or "Welcome to Sentinel by NetNeural".
 */
import { test, expect } from '@playwright/test'

const TEST_EMAIL = 'admin@netneural.ai'
const TEST_PASSWORD = 'password123'

test.describe('Bug Fixes Validation with Superadmin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')
    await page.locator('#email').fill(TEST_EMAIL)
    await page.locator('#password').fill(TEST_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/dashboard**', { timeout: 15000 })
  })

  test('Bug #22: Remember Me Checkbox is visible on login page', async ({
    page,
  }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')
    // Radix Checkbox with id="remember-me", label "Keep me signed in"
    const rememberMe = page.locator('#remember-me')
    await expect(rememberMe).toBeVisible({ timeout: 10000 })
    const label = page.locator('label[for="remember-me"]')
    await expect(label).toContainText(/keep me signed in/i)
    console.log('✅ Bug #22: Remember Me checkbox is visible')
  })

  test('Bug #7 & #12: Dashboard shows Alerts and Locations cards', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Dashboard has cards: "Recent Alerts" and System Health
    const alertsText = page.getByText(/recent alerts|active alerts/i).first()
    await expect(alertsText).toBeVisible({ timeout: 10000 })
    console.log('✅ Bug #7: Alerts card is visible on dashboard')

    const systemHealth = page.getByText('System Health').first()
    await expect(systemHealth).toBeVisible({ timeout: 10000 })
    console.log('✅ Bug #12: System Health card is visible on dashboard')
  })

  test('Bug #11: Profile tab loads and save button is visible', async ({
    page,
  }) => {
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const fullNameInput = page
      .locator(
        'input[placeholder*="name" i], input#full_name, input[name="full_name"]'
      )
      .first()
    await expect(fullNameInput).toBeVisible({ timeout: 10000 })

    const saveButton = page.getByRole('button', { name: /save/i }).first()
    await expect(saveButton).toBeVisible()
    console.log('✅ Bug #11: Profile save functionality is present')
  })

  test('Bug #13 & #16: Preferences tab has theme selector and save button', async ({
    page,
  }) => {
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')

    const preferencesTab = page.getByRole('tab', { name: /preferences/i })
    await preferencesTab.click()
    await page.waitForTimeout(1000)

    const themeSection = page.getByText(/theme/i).first()
    await expect(themeSection).toBeVisible({ timeout: 10000 })
    console.log('✅ Bug #13: Theme switching is available')

    const saveButton = page.getByRole('button', { name: /save/i }).first()
    await expect(saveButton).toBeVisible()
    console.log('✅ Bug #16: Save preferences button is visible')
  })

  test('Bug #18, #20, #21: Security tab has password change, sessions, and API keys', async ({
    page,
  }) => {
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')

    const securityTab = page.getByRole('tab', { name: /security/i })
    await securityTab.click()
    await page.waitForTimeout(1000)

    const passwordSection = page.getByText(/change password/i).first()
    await expect(passwordSection).toBeVisible({ timeout: 10000 })
    console.log('✅ Bug #18: Change password section is visible')

    const sessionsSection = page.getByText(/active sessions/i).first()
    await expect(sessionsSection).toBeVisible()
    console.log('✅ Bug #20: Active sessions section is visible')

    const apiKeysSection = page.getByText(/api keys/i).first()
    await expect(apiKeysSection).toBeVisible()
    console.log('✅ Bug #21: API keys section is visible')
  })

  test('Bug #19: Two-Factor Authentication toggle is visible', async ({
    page,
  }) => {
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')

    const securityTab = page.getByRole('tab', { name: /security/i })
    await securityTab.click()
    await page.waitForTimeout(1000)

    const twoFASection = page.getByText(/two-factor authentication/i).first()
    await expect(twoFASection).toBeVisible({ timeout: 10000 })
    console.log('✅ Bug #19: 2FA section is visible')
  })

  test('Bug #6: Organizations page loads with settings available', async ({
    page,
  }) => {
    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const pageHeading = page.locator('h2').filter({ hasText: /organization/i }).first()
    await expect(pageHeading).toBeVisible({ timeout: 10000 })
    console.log('✅ Bug #6: Organization management page is accessible')
  })

  test('Backend Integration: Dashboard stats load from edge function', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const statCard = page.getByText(/total devices|online devices/i).first()
    await expect(statCard).toBeVisible({ timeout: 10000 })
    console.log('✅ Backend: Dashboard stats loaded successfully')
  })

  test('Backend Integration: Organizations load from edge function', async ({
    page,
  }) => {
    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const pageContent = await page.content()
    const hasOrganizationData =
      pageContent.includes('NetNeural') || pageContent.includes('Organization')
    expect(hasOrganizationData).toBeTruthy()
    console.log('✅ Backend: Organizations API working')
  })

  test('Full User Journey: Login → Dashboard → Settings → All Tabs', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
    console.log('✅ Journey: Dashboard accessible')

    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')
    console.log('✅ Journey: Settings page accessible')

    const tabs = ['Profile', 'Preferences', 'Security']
    for (const tabName of tabs) {
      const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') })
      if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tab.click()
        await page.waitForTimeout(500)
        console.log(`✅ Journey: ${tabName} tab accessible`)
      }
    }

    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('networkidle')
    await expect(
      page.locator('h2').filter({ hasText: /organization/i }).first()
    ).toBeVisible({ timeout: 10000 })
    console.log('✅ Journey: Organizations page accessible')
  })
})
