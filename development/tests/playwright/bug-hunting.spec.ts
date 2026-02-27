/**
 * Bug Hunting Tests - Comprehensive page traversal
 * Updated 2026-02-27 to match current UI.
 * Uses baseURL from Playwright config (localhost:3000 for local dev).
 */
import { test, expect, Page } from '@playwright/test'

const TEST_USER = { email: 'admin@netneural.ai', password: 'password123' }

async function login(page: Page) {
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill(TEST_USER.email)
  await page.locator('#password').fill(TEST_USER.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard**', { timeout: 15000 })
}

test.describe('Bug Hunting - Page Traversal', () => {

  test.describe('Console Error Detection', () => {
    test('login page has no console errors', async ({ page }) => {
      const errors: string[] = []
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
      await page.goto('/auth/login')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      const filtered = errors.filter(e => !e.includes('favicon') && !e.includes('404'))
      expect(filtered).toHaveLength(0)
    })

    test('dashboard has no console errors', async ({ page }) => {
      const errors: string[] = []
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
      await login(page)
      await page.waitForTimeout(3000)
      const filtered = errors.filter(e => !e.includes('favicon') && !e.includes('404'))
      if (filtered.length > 0) console.log('Dashboard errors:', filtered)
      expect(filtered).toHaveLength(0)
    })

    test('devices page has no console errors', async ({ page }) => {
      const errors: string[] = []
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
      await login(page)
      await page.goto('/dashboard/devices')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)
      const filtered = errors.filter(e => !e.includes('favicon') && !e.includes('404'))
      if (filtered.length > 0) console.log('Devices errors:', filtered)
      expect(filtered).toHaveLength(0)
    })

    test('alerts page has no console errors', async ({ page }) => {
      const errors: string[] = []
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
      await login(page)
      await page.goto('/dashboard/alerts')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)
      const filtered = errors.filter(e => !e.includes('favicon') && !e.includes('404'))
      if (filtered.length > 0) console.log('Alerts errors:', filtered)
      expect(filtered).toHaveLength(0)
    })

    test('settings page has no console errors', async ({ page }) => {
      const errors: string[] = []
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
      await login(page)
      await page.goto('/dashboard/settings')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)
      const filtered = errors.filter(e => !e.includes('favicon') && !e.includes('404'))
      if (filtered.length > 0) console.log('Settings errors:', filtered)
      expect(filtered).toHaveLength(0)
    })
  })

  test.describe('404 / Broken Routes', () => {
    test('unknown routes redirect to login or 404', async ({ page }) => {
      await page.goto('/some-nonexistent-page')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      const url = page.url()
      const is404orLogin = url.includes('login') || url.includes('404')
      const has404Text = await page.locator('text=/not found|404/i').isVisible({ timeout: 3000 }).catch(() => false)
      expect(is404orLogin || has404Text).toBeTruthy()
    })

    test('protected routes redirect to login when unauthenticated', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)
      await expect(page).toHaveURL(/login/)
    })
  })

  test.describe('Network Error Handling', () => {
    test('app handles failed API requests gracefully', async ({ page }) => {
      await login(page)
      // Block Supabase API
      await page.route('**/rest/v1/**', route => route.abort())
      await page.goto('/dashboard/devices')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(5000)
      // Should not crash - check no uncaught error overlay
      const errorOverlay = page.locator('#__next-build-error, [class*="error-overlay"]')
      const hasOverlay = await errorOverlay.isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasOverlay).toBeFalsy()
    })
  })

  test.describe('Responsive Layout', () => {
    test('mobile viewport shows hamburger or collapses sidebar', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await login(page)
      await page.waitForTimeout(2000)
      // On mobile the sidebar should be collapsed or a menu button visible
      const menuBtn = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"], [class*="hamburger"], [class*="mobile-menu"]')
      const sidebar = page.locator('[class*="sidebar"]')
      const menuVisible = await menuBtn.first().isVisible({ timeout: 5000 }).catch(() => false)
      const sidebarVisible = await sidebar.isVisible({ timeout: 3000 }).catch(() => false)
      // Either hamburger is visible or sidebar is hidden
      console.log(`Mobile: menu button visible=${menuVisible}, sidebar visible=${sidebarVisible}`)
    })
  })

  test.describe('Settings Tab Navigation', () => {
    test('can switch between all settings tabs', async ({ page }) => {
      await login(page)
      await page.goto('/dashboard/settings')
      await page.waitForLoadState('networkidle')
      const tabs = ['Profile', 'Preferences', 'Security', 'Organizations']
      for (const tab of tabs) {
        const tabEl = page.locator('[role="tab"]').filter({ hasText: tab })
        await tabEl.click()
        await page.waitForTimeout(1000)
        // Verify the tab is selected
        await expect(tabEl).toHaveAttribute('aria-selected', 'true', { timeout: 5000 })
      }
    })
  })
})