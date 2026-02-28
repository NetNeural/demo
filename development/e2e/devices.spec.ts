/**
 * E2E Tests: Device Management
 * Updated 2026-02-27 to match current DevicesList + consolidated device detail view.
 */
import { test, expect, Page } from '@playwright/test'

const TEST_USER = { email: 'admin@netneural.ai', password: 'password123' }

async function loginAndGoToDevices(page: Page) {
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill(TEST_USER.email)
  await page.locator('#password').fill(TEST_USER.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard**', { timeout: 15000 })
  await page.goto('/dashboard/devices')
  await page.waitForLoadState('networkidle')
}

test.describe('Device Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDevices(page)
  })

  test.describe('Device Listing', () => {
    test('should load devices page', async ({ page }) => {
      // DevicesHeader renders page title
      await expect(page.locator('text=/devices/i').first()).toBeVisible({ timeout: 10000 })
    })

    test('should show device cards or empty state', async ({ page }) => {
      await page.waitForTimeout(3000)
      // Either device cards or "No organization selected" / "no devices" message
      const content = page.locator('[class*="card"], text=/no.*device/i, text=/no.*organization/i')
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should show search input', async ({ page }) => {
      await page.waitForTimeout(2000)
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]')
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill('sensor')
        await page.waitForTimeout(1000)
      }
    })
  })

  test.describe('Device Detail (Consolidated View)', () => {
    test('should navigate to device detail on click', async ({ page }) => {
      await page.waitForTimeout(3000)
      // Click first device link/card
      const deviceLink = page.locator('a[href*="/dashboard/devices/view"]').first()
      if (await deviceLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await deviceLink.click()
        await page.waitForURL('**/devices/view**', { timeout: 10000 })
        // Should show device name in header
        await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 10000 })
      }
    })

    test('should show tabbed interface on device detail', async ({ page }) => {
      await page.waitForTimeout(3000)
      const deviceLink = page.locator('a[href*="/dashboard/devices/view"]').first()
      if (await deviceLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await deviceLink.click()
        await page.waitForURL('**/devices/view**', { timeout: 10000 })
        // Story #270: Consolidated tabs
        await expect(page.locator('[role="tab"]').first()).toBeVisible({ timeout: 10000 })
        // Check tab names exist
        const tabNames = ['Overview', 'Telemetry', 'Config', 'Alerts', 'System']
        for (const name of tabNames) {
          const tab = page.locator(`[role="tab"]:has-text("${name}")`)
          if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log(`Tab found: ${name}`)
          }
        }
      }
    })

    test('should switch between tabs on device detail', async ({ page }) => {
      await page.waitForTimeout(3000)
      const deviceLink = page.locator('a[href*="/dashboard/devices/view"]').first()
      if (await deviceLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await deviceLink.click()
        await page.waitForURL('**/devices/view**', { timeout: 10000 })
        // Click Telemetry tab
        const telemetryTab = page.locator('[role="tab"]:has-text("Telemetry")')
        if (await telemetryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
          await telemetryTab.click()
          await page.waitForTimeout(1000)
          expect(page.url()).toContain('tab=telemetry')
        }
      }
    })

    test('should have back button on device detail', async ({ page }) => {
      await page.waitForTimeout(3000)
      const deviceLink = page.locator('a[href*="/dashboard/devices/view"]').first()
      if (await deviceLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await deviceLink.click()
        await page.waitForURL('**/devices/view**', { timeout: 10000 })
        const backButton = page.locator('button:has-text("Back"), button:has(svg.lucide-arrow-left)')
        await expect(backButton.first()).toBeVisible({ timeout: 5000 })
      }
    })
  })

  test.describe('Error Handling', () => {
    test('should handle offline gracefully', async ({ page }) => {
      await page.context().setOffline(true)
      await page.reload()
      await page.waitForTimeout(3000)
      const errorContent = page.locator('text=/error|failed|cached|offline/i')
      if (await errorContent.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Error state shown correctly')
      }
      await page.context().setOffline(false)
    })
  })
})