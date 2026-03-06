/**
 * Production Validation Tests
 * Updated 2026-02-27 - verifies staging/production deploys work correctly.
 * Run against any environment by setting baseURL in playwright config.
 */
import { test, expect, Page } from '@playwright/test'

const TEST_USER = { email: 'admin@netneural.ai', password: 'password123' }

async function login(page: Page) {
  await page.goto('/auth/login')
  await page.waitForLoadState('load')
  await page.locator('#email').fill(TEST_USER.email)
  await page.locator('#password').fill(TEST_USER.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard**', { timeout: 15000 })
}

test.describe('Production Smoke Tests', () => {
  test.describe('Login & Auth', () => {
    test('login page loads and shows branding', async ({ page }) => {
      await page.goto('/auth/login')
      await page.waitForLoadState('load')
      await expect(page.locator('#email')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('#password')).toBeVisible()
      await expect(page.locator('button[type="submit"]')).toBeVisible()
      // "Keep me signed in" label
      const keepMeLabel = page.locator('label[for="remember-me"]')
      await expect(keepMeLabel).toContainText(/keep me signed in/i)
    })

    test('can log in successfully', async ({ page }) => {
      await login(page)
      await expect(page).toHaveURL(/dashboard/)
    })
  })

  test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await login(page)
    })

    test('dashboard loads with stat cards', async ({ page }) => {
      const expectedCards = [
        'Total Devices',
        'Online Devices',
        'Active Alerts',
        'Team Members',
      ]
      for (const cardTitle of expectedCards) {
        await expect(page.locator(`text=${cardTitle}`)).toBeVisible({
          timeout: 10000,
        })
      }
    })

    test('sidebar navigation works', async ({ page }) => {
      const navItems = [
        { text: 'Devices', url: /devices/ },
        { text: 'Alerts', url: /alerts/ },
        { text: 'Settings', url: /settings/ },
      ]
      for (const item of navItems) {
        const link = page
          .locator(`a, button`)
          .filter({ hasText: new RegExp(item.text, 'i') })
          .first()
        if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
          await link.click()
          await page.waitForLoadState('load')
          await expect(page).toHaveURL(item.url)
          // Navigate back to dashboard
          await page.goto('/dashboard')
          await page.waitForLoadState('load')
        }
      }
    })
  })

  test.describe('Devices Page', () => {
    test.beforeEach(async ({ page }) => {
      await login(page)
      await page.goto('/dashboard/devices')
      await page.waitForLoadState('load')
    })

    test('devices page loads', async ({ page }) => {
      await page.waitForTimeout(3000)
      const content = page.locator('text=/device/i').first()
      await expect(content).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Settings Page', () => {
    test.beforeEach(async ({ page }) => {
      await login(page)
      await page.goto('/dashboard/settings')
      await page.waitForLoadState('load')
    })

    test('settings page has correct tabs', async ({ page }) => {
      const tabs = ['Profile', 'Preferences', 'Security', 'Organizations']
      for (const tab of tabs) {
        const tabElement = page.locator(`[role="tab"]`).filter({ hasText: tab })
        await expect(tabElement).toBeVisible({ timeout: 10000 })
      }
    })
  })

  test.describe('Alerts Page', () => {
    test.beforeEach(async ({ page }) => {
      await login(page)
      await page.goto('/dashboard/alerts')
      await page.waitForLoadState('load')
    })

    test('alerts page loads', async ({ page }) => {
      await page.waitForTimeout(2000)
      const content = page.locator('text=/alert/i').first()
      await expect(content).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Billing / Administration Page', () => {
    test.beforeEach(async ({ page }) => {
      await login(page)
      await page.goto('/dashboard/billing')
      await page.waitForLoadState('load')
    })

    test('billing page loads with tab navigation', async ({ page }) => {
      await page.waitForTimeout(2000)
      const tabs = page.locator('[role="tab"]')
      await expect(tabs.first()).toBeVisible({ timeout: 10000 })
    })

    test('overview tab shows plan or billing information', async ({ page }) => {
      await page.waitForTimeout(2000)
      const content = page.locator('text=/plan|billing|subscription/i').first()
      await expect(content).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Organization Management', () => {
    test.beforeEach(async ({ page }) => {
      await login(page)
      await page.goto('/dashboard/settings')
      await page.waitForLoadState('load')
    })

    test('organizations tab is accessible', async ({ page }) => {
      const orgTab = page
        .locator('[role="tab"]')
        .filter({ hasText: 'Organizations' })
      await expect(orgTab).toBeVisible({ timeout: 10000 })
      await orgTab.click()
      await page.waitForTimeout(1000)
      const content = page.locator('text=/organization/i').first()
      await expect(content).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Security — no mixed content', () => {
    test('no HTTP requests in authenticated session', async ({ page }) => {
      const insecureRequests: string[] = []
      page.on('request', (req) => {
        const url = req.url()
        if (
          url.startsWith('http://') &&
          !url.startsWith('http://localhost') &&
          !url.startsWith('http://127.')
        ) {
          insecureRequests.push(url)
        }
      })
      await login(page)
      await page.waitForTimeout(3000)
      if (insecureRequests.length > 0) {
        console.warn('Insecure HTTP requests detected:', insecureRequests)
      }
      expect(insecureRequests).toHaveLength(0)
    })
  })

  test.describe('Page Performance', () => {
    test('all key pages load within 10s', async ({ page }) => {
      const pages = [
        '/auth/login',
        '/dashboard',
        '/dashboard/devices',
        '/dashboard/alerts',
        '/dashboard/settings',
        '/dashboard/billing',
      ]
      for (const p of pages) {
        const start = Date.now()
        await page.goto(p)
        await page.waitForLoadState('load')
        const elapsed = Date.now() - start
        console.log(`${p} loaded in ${elapsed}ms`)
        expect(elapsed).toBeLessThan(10000)
      }
    })
  })
})
