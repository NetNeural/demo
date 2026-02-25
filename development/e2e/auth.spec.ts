/**
 * E2E Tests: Authentication Flows
 *
 * Tests user authentication, login/logout flows, and session management
 */

import { test, expect, Page } from '@playwright/test'

// Test user credentials (should be seeded in local Supabase)
const TEST_USER = {
  email: 'test@netneural.ai',
  password: 'TestPassword123!',
  name: 'Test User',
}

const TEST_ADMIN = {
  email: 'admin@netneural.ai',
  password: 'AdminPassword123!',
  name: 'Admin User',
}

/**
 * Helper: Navigate to login page
 */
async function navigateToLogin(page: Page) {
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')
}

/**
 * Helper: Perform login
 */
async function performLogin(page: Page, email: string, password: string) {
  const emailInput = page
    .locator('input[type="email"], input[name="email"]')
    .first()
  const passwordInput = page
    .locator('input[type="password"], input[name="password"]')
    .first()

  await expect(emailInput).toBeVisible({ timeout: 10000 })
  await emailInput.fill(email)
  await passwordInput.fill(password)

  const loginButton = page
    .locator('button[type="submit"]')
    .filter({ hasText: /sign in|log in|login/i })
    .first()
  await loginButton.click()
}

/**
 * Helper: Verify user is logged in
 */
async function verifyLoggedIn(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 })
  const url = page.url()
  expect(url).toMatch(/dashboard/)
}

/**
 * Helper: Perform logout
 */
async function performLogout(page: Page) {
  // Click user menu or profile icon
  const userMenu = page
    .locator(
      '[data-testid="user-menu"], button:has-text("Profile"), button:has-text("Menu")'
    )
    .first()
  await userMenu.click()

  // Click logout button
  const logoutButton = page
    .locator(
      'button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")'
    )
    .first()
  await logoutButton.click()

  await page.waitForLoadState('networkidle')
}

test.describe('Authentication Flows', () => {
  test.describe('Login Flow', () => {
    test('should load login page successfully', async ({ page }) => {
      await navigateToLogin(page)

      // Verify page elements are visible
      await expect(page.locator('input[type="email"]').first()).toBeVisible()
      await expect(page.locator('input[type="password"]').first()).toBeVisible()
      await expect(page.locator('button[type="submit"]').first()).toBeVisible()

      // Verify page title
      const title = await page.title()
      expect(title).toMatch(/login|sign in|netneural/i)
    })

    test('should validate required fields', async ({ page }) => {
      await navigateToLogin(page)

      // Try to submit without filling fields
      const loginButton = page.locator('button[type="submit"]').first()
      await loginButton.click()

      // Should remain on login page or show error
      await page.waitForTimeout(1000)
      const url = page.url()
      expect(url).toMatch(/login/)
    })

    test('should show error for invalid credentials', async ({ page }) => {
      await navigateToLogin(page)

      await performLogin(page, 'invalid@email.com', 'wrongpassword')

      // Should show error message
      await page.waitForTimeout(2000)
      const errorMessage = page
        .locator('text=/invalid|incorrect|failed|error/i')
        .first()
      await expect(errorMessage).toBeVisible({ timeout: 5000 })
    })

    test('should successfully login with valid credentials', async ({
      page,
    }) => {
      await navigateToLogin(page)

      await performLogin(page, TEST_USER.email, TEST_USER.password)

      // Should redirect to dashboard
      await verifyLoggedIn(page)

      // Verify dashboard elements are visible
      await expect(
        page.locator('text=/dashboard|home|overview/i').first()
      ).toBeVisible()
    })

    test('should remember login state after refresh', async ({ page }) => {
      // Login first
      await navigateToLogin(page)
      await performLogin(page, TEST_USER.email, TEST_USER.password)
      await verifyLoggedIn(page)

      // Refresh page
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Should still be logged in
      const url = page.url()
      expect(url).toMatch(/dashboard/)
    })

    test('should redirect to dashboard if already logged in', async ({
      page,
    }) => {
      // Login first
      await navigateToLogin(page)
      await performLogin(page, TEST_USER.email, TEST_USER.password)
      await verifyLoggedIn(page)

      // Try to access login page again
      await page.goto('/auth/login')
      await page.waitForLoadState('networkidle')

      // Should redirect to dashboard
      const url = page.url()
      expect(url).toMatch(/dashboard/)
    })
  })

  test.describe('Logout Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each logout test
      await navigateToLogin(page)
      await performLogin(page, TEST_USER.email, TEST_USER.password)
      await verifyLoggedIn(page)
    })

    test('should successfully logout', async ({ page }) => {
      await performLogout(page)

      // Should redirect to login page
      const url = page.url()
      expect(url).toMatch(/login|auth/)
    })

    test('should clear session after logout', async ({ page }) => {
      await performLogout(page)

      // Try to access protected page
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Should redirect to login
      const url = page.url()
      expect(url).toMatch(/login|auth/)
    })

    test('should redirect to login when accessing protected routes', async ({
      page,
    }) => {
      await performLogout(page)

      const protectedRoutes = [
        '/dashboard',
        '/dashboard/devices',
        '/dashboard/alerts',
        '/dashboard/settings',
      ]

      for (const route of protectedRoutes) {
        await page.goto(route)
        await page.waitForLoadState('networkidle')

        const url = page.url()
        expect(url).toMatch(/login|auth/)
      }
    })
  })

  test.describe('Session Management', () => {
    test('should maintain session across multiple pages', async ({ page }) => {
      await navigateToLogin(page)
      await performLogin(page, TEST_USER.email, TEST_USER.password)
      await verifyLoggedIn(page)

      // Navigate to different pages
      const pages = ['/dashboard', '/dashboard/devices', '/dashboard/alerts']

      for (const pagePath of pages) {
        await page.goto(pagePath)
        await page.waitForLoadState('networkidle')

        // Should not redirect to login
        const url = page.url()
        expect(url).not.toMatch(/login|auth/)
        expect(url).toMatch(new RegExp(pagePath))
      }
    })

    test('should show user info in dashboard', async ({ page }) => {
      await navigateToLogin(page)
      await performLogin(page, TEST_USER.email, TEST_USER.password)
      await verifyLoggedIn(page)

      // User menu or profile should show user email or name
      const userInfo = page
        .locator(`text=${TEST_USER.email}, text=${TEST_USER.name}`)
        .first()
      await expect(userInfo).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Remember Me Functionality', () => {
    test('should display Remember Me checkbox', async ({ page }) => {
      await navigateToLogin(page)

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
    })

    test('should persist session when Remember Me is checked', async ({
      page,
      context,
    }) => {
      await navigateToLogin(page)

      // Check Remember Me
      const rememberMeCheckbox = page
        .locator('label:has-text("Remember Me")')
        .locator('input[type="checkbox"]')
        .first()
      await rememberMeCheckbox.check()

      await performLogin(page, TEST_USER.email, TEST_USER.password)
      await verifyLoggedIn(page)

      // Close and reopen browser (new page in same context)
      await page.close()
      const newPage = await context.newPage()
      await newPage.goto('/dashboard')
      await newPage.waitForLoadState('networkidle')

      // Should still be logged in
      const url = newPage.url()
      expect(url).toMatch(/dashboard/)
    })
  })

  test.describe('Password Reset Flow', () => {
    test('should display forgot password link', async ({ page }) => {
      await navigateToLogin(page)

      const forgotPasswordLink = page
        .locator('a:has-text("Forgot Password"), a:has-text("Reset Password")')
        .first()
      await expect(forgotPasswordLink).toBeVisible()
    })

    test('should navigate to password reset page', async ({ page }) => {
      await navigateToLogin(page)

      const forgotPasswordLink = page
        .locator('a:has-text("Forgot Password"), a:has-text("Reset Password")')
        .first()
      await forgotPasswordLink.click()
      await page.waitForLoadState('networkidle')

      const url = page.url()
      expect(url).toMatch(/reset|forgot/)
    })
  })

  test.describe('Multi-tenant Isolation', () => {
    test('should show only user-specific data', async ({ page }) => {
      await navigateToLogin(page)
      await performLogin(page, TEST_USER.email, TEST_USER.password)
      await verifyLoggedIn(page)

      // Navigate to devices page
      await page.goto('/dashboard/devices')
      await page.waitForLoadState('networkidle')

      // Verify devices are loaded (if any)
      // This is a placeholder - actual verification depends on seeded data
      const devicesSection = page
        .locator('[data-testid="devices-list"], text=Devices')
        .first()
      await expect(devicesSection).toBeVisible()
    })
  })
})
