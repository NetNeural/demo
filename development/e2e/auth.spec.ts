/**
 * E2E Tests: Authentication Flows
 * Updated 2026-02-27 to match current login page selectors.
 * Login: #email, #password, #remember-me (Radix), "Sign in" button, "Keep me signed in" label
 */
import { test, expect, Page } from '@playwright/test'

const TEST_USER = { email: 'admin@netneural.ai', password: 'password123' }

async function navigateToLogin(page: Page) {
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')
}

async function performLogin(page: Page, email: string, password: string) {
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.locator('button[type="submit"]').click()
}

async function loginAndGo(page: Page, path = '/dashboard') {
  await navigateToLogin(page)
  await performLogin(page, TEST_USER.email, TEST_USER.password)
  await page.waitForURL('**/dashboard**', { timeout: 15000 })
  if (path !== '/dashboard') {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
  }
}

test.describe('Authentication Flows', () => {
  test.describe('Login Page UI', () => {
    test('should render all form elements', async ({ page }) => {
      await navigateToLogin(page)
      await expect(page.locator('#email')).toBeVisible()
      await expect(page.locator('#password')).toBeVisible()
      await expect(page.locator('button[type="submit"]')).toBeVisible()
      await expect(page.locator('#remember-me')).toBeVisible()
      await expect(page.locator('label[for="remember-me"]')).toContainText('Keep me signed in')
    })

    test('should show Sentinel branding', async ({ page }) => {
      await navigateToLogin(page)
      await expect(page.locator('h1').first()).toBeVisible()
      await expect(page.locator('text=Sentinel').first()).toBeVisible()
    })

    test('should show security footer', async ({ page }) => {
      await navigateToLogin(page)
      await expect(page.locator('text=Enterprise-grade security')).toBeVisible()
      await expect(page.locator('text=256-bit encryption')).toBeVisible()
    })

    test('should show error for invalid credentials', async ({ page }) => {
      await navigateToLogin(page)
      await performLogin(page, 'nobody@example.com', 'wrongpassword')
      await expect(page.locator('text=Invalid email or password')).toBeVisible({ timeout: 10000 })
    })

    test('should not submit with empty required fields', async ({ page }) => {
      await navigateToLogin(page)
      await page.locator('button[type="submit"]').click()
      await page.waitForTimeout(500)
      expect(page.url()).toMatch(/login/)
    })
  })

  test.describe('Login & Session', () => {
    test('should login and redirect to dashboard', async ({ page }) => {
      await loginAndGo(page)
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })
    })

    test('should persist session after refresh', async ({ page }) => {
      await loginAndGo(page)
      await page.reload()
      await page.waitForLoadState('networkidle')
      expect(page.url()).toMatch(/dashboard/)
    })

    test('should redirect to dashboard when visiting login while authenticated', async ({ page }) => {
      await loginAndGo(page)
      await page.goto('/auth/login')
      await page.waitForLoadState('networkidle')
      await page.waitForURL('**/dashboard**', { timeout: 10000 })
    })

    test('should maintain session across all protected routes', async ({ page }) => {
      await loginAndGo(page)
      for (const route of ['/dashboard', '/dashboard/devices', '/dashboard/alerts', '/dashboard/settings']) {
        await page.goto(route)
        await page.waitForLoadState('networkidle')
        expect(page.url()).not.toMatch(/login/)
      }
    })

    test('should redirect unauthenticated users to login', async ({ page, context }) => {
      await context.clearCookies()
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      await page.waitForURL('**/login**', { timeout: 10000 })
    })
  })
})