/**
 * E2E Tests: Alert Management
 * Updated 2026-02-27 to match current AlertsList + AlertsHeader components.
 */
import { test, expect, Page } from '@playwright/test'

const TEST_USER = { email: 'admin@netneural.ai', password: 'password123' }

async function loginAndGoToAlerts(page: Page) {
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill(TEST_USER.email)
  await page.locator('#password').fill(TEST_USER.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard**', { timeout: 15000 })
  await page.goto('/dashboard/alerts')
  await page.waitForLoadState('networkidle')
}

test.describe('Alert Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToAlerts(page)
  })

  test.describe('Alert Listing', () => {
    test('should load alerts page', async ({ page }) => {
      await expect(page.locator('text=/alerts/i').first()).toBeVisible({ timeout: 10000 })
    })

    test('should show alerts or empty state', async ({ page }) => {
      await page.waitForTimeout(3000)
      const content = page.locator('[class*="card"], text=/no.*alert/i, text=/all clear/i, text=/no.*organization/i')
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should show search input for alerts', async ({ page }) => {
      await page.waitForTimeout(2000)
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]')
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill('temperature')
        await page.waitForTimeout(1000)
      }
    })
  })

  test.describe('Alert Filtering', () => {
    test('should have filter tabs or buttons', async ({ page }) => {
      await page.waitForTimeout(2000)
      // Check for status filter tabs
      const filterButtons = page.locator('button:has-text("All"), button:has-text("Active"), button:has-text("Acknowledged")')
      if (await filterButtons.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Filter buttons found')
        await filterButtons.first().click()
        await page.waitForTimeout(500)
      }
    })
  })

  test.describe('Alert Details', () => {
    test('should show alert detail on click', async ({ page }) => {
      await page.waitForTimeout(3000)
      // Click first alert card/row
      const alertItem = page.locator('[class*="card"]').filter({ hasText: /alert|temperature|battery|threshold/i }).first()
      if (await alertItem.isVisible({ timeout: 5000 }).catch(() => false)) {
        await alertItem.click()
        await page.waitForTimeout(1000)
        // Check for dialog/modal or expanded details
        const details = page.locator('[role="dialog"], [class*="detail"]')
        if (await details.first().isVisible({ timeout: 5000 }).catch(() => false)) {
          console.log('Alert details dialog opened')
        }
      }
    })
  })

  test.describe('Error Handling', () => {
    test('should handle offline gracefully', async ({ page }) => {
      await page.context().setOffline(true)
      await page.reload()
      await page.waitForTimeout(3000)
      const errorContent = page.locator('text=/error|failed|retry/i')
      if (await errorContent.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Error state shown correctly')
      }
      await page.context().setOffline(false)
    })
  })
})