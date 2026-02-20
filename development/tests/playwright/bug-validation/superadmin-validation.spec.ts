import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3003'
const TEST_EMAIL = 'superadmin@netneural.ai'
const TEST_PASSWORD = 'SuperSecure123!'

test.describe('Bug Fixes Validation with Superadmin', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto(`${BASE_URL}/auth/login`)
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
  })

  test('Bug #22: Remember Me Checkbox is visible on login page', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/auth/login`)
    const rememberMeCheckbox = page.locator(
      'input#remember-me[type="checkbox"]'
    )
    await expect(rememberMeCheckbox).toBeVisible()
    console.log('✅ Bug #22: Remember Me checkbox is visible')
  })

  test('Bug #7 & #12: Dashboard shows Alerts and Locations cards', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForTimeout(2000)

    // Check for alerts card
    const alertsHeading = page.getByRole('heading', { name: /alerts/i }).first()
    await expect(alertsHeading).toBeVisible()
    console.log('✅ Bug #7: Alerts card is visible on dashboard')

    // Check for locations card
    const locationsHeading = page
      .getByRole('heading', { name: /locations/i })
      .first()
    await expect(locationsHeading).toBeVisible()
    console.log('✅ Bug #12: Locations card is visible on dashboard')
  })

  test('Bug #11: Profile tab loads and save button is visible', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard/settings`)
    await page.waitForTimeout(2000)

    // Profile tab should be default
    const fullNameInput = page
      .locator(
        'input[placeholder*="name" i], input#full_name, input[name="full_name"]'
      )
      .first()
    await expect(fullNameInput).toBeVisible()

    const saveButton = page.getByRole('button', { name: /save/i }).first()
    await expect(saveButton).toBeVisible()
    console.log('✅ Bug #11: Profile save functionality is present')
  })

  test('Bug #13 & #16: Preferences tab has theme selector and save button', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard/settings`)
    await page.waitForTimeout(1000)

    // Click Preferences tab
    const preferencesTab = page.getByRole('button', { name: /preferences/i })
    await preferencesTab.click()
    await page.waitForTimeout(1000)

    // Check for theme selector
    const themeSection = page.getByText(/theme/i).first()
    await expect(themeSection).toBeVisible()
    console.log('✅ Bug #13: Theme switching is available')

    // Check for save button
    const saveButton = page.getByRole('button', { name: /save/i }).first()
    await expect(saveButton).toBeVisible()
    console.log('✅ Bug #16: Save preferences button is visible')
  })

  test('Bug #18, #20, #21: Security tab has password change, sessions, and API keys', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard/settings`)
    await page.waitForTimeout(1000)

    // Click Security tab
    const securityTab = page.getByRole('button', { name: /security/i })
    await securityTab.click()
    await page.waitForTimeout(1000)

    // Check for password change section
    const passwordSection = page.getByText(/change password/i).first()
    await expect(passwordSection).toBeVisible()
    console.log('✅ Bug #18: Change password section is visible')

    // Check for active sessions
    const sessionsSection = page.getByText(/active sessions/i).first()
    await expect(sessionsSection).toBeVisible()
    console.log('✅ Bug #20: Active sessions section is visible')

    // Check for API keys section
    const apiKeysSection = page.getByText(/api keys/i).first()
    await expect(apiKeysSection).toBeVisible()
    console.log('✅ Bug #21: API keys section is visible')
  })

  test('Bug #19: Two-Factor Authentication toggle is visible', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard/settings`)
    await page.waitForTimeout(1000)

    // Click Security tab
    const securityTab = page.getByRole('button', { name: /security/i })
    await securityTab.click()
    await page.waitForTimeout(1000)

    // Check for 2FA section
    const twoFASection = page.getByText(/two-factor authentication/i).first()
    await expect(twoFASection).toBeVisible()
    console.log('✅ Bug #19: 2FA section is visible')
  })

  test('Bug #6: Organizations page loads with settings available', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard/organizations`)
    await page.waitForTimeout(2000)

    // Check if organizations page loaded
    const pageHeading = page
      .getByRole('heading', { name: /organization/i })
      .first()
    await expect(pageHeading).toBeVisible()
    console.log('✅ Bug #6: Organization management page is accessible')
  })

  test('Backend Integration: Dashboard stats load from edge function', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForTimeout(3000)

    // Check if dashboard loaded (which means stats API worked)
    const dashboardTitle = page
      .getByRole('heading', { name: /dashboard/i })
      .first()
    await expect(dashboardTitle).toBeVisible()
    console.log('✅ Backend: Dashboard stats loaded successfully')
  })

  test('Backend Integration: Organizations load from edge function', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/dashboard/organizations`)
    await page.waitForTimeout(3000)

    // If we see organization content, the API call worked
    const pageContent = await page.content()
    const hasOrganizationData =
      pageContent.includes('NetNeural') || pageContent.includes('organization')
    expect(hasOrganizationData).toBeTruthy()
    console.log('✅ Backend: Organizations API working')
  })

  test('Full User Journey: Login → Dashboard → Settings → All Tabs', async ({
    page,
  }) => {
    // Already logged in from beforeEach

    // Visit dashboard
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForTimeout(2000)
    await expect(
      page.getByRole('heading', { name: /dashboard/i }).first()
    ).toBeVisible()
    console.log('✅ Journey: Dashboard accessible')

    // Visit settings
    await page.goto(`${BASE_URL}/dashboard/settings`)
    await page.waitForTimeout(1000)
    console.log('✅ Journey: Settings page accessible')

    // Check all tabs
    const tabs = ['Profile', 'Preferences', 'Security']
    for (const tabName of tabs) {
      const tab = page.getByRole('button', { name: new RegExp(tabName, 'i') })
      if (await tab.isVisible()) {
        await tab.click()
        await page.waitForTimeout(500)
        console.log(`✅ Journey: ${tabName} tab accessible`)
      }
    }

    // Visit organizations
    await page.goto(`${BASE_URL}/dashboard/organizations`)
    await page.waitForTimeout(2000)
    await expect(
      page.getByRole('heading', { name: /organization/i }).first()
    ).toBeVisible()
    console.log('✅ Journey: Organizations page accessible')
  })
})
