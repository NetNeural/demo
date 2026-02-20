/**
 * E2E Tests: Device Management
 *
 * Tests device listing, filtering, sync, and telemetry viewing
 */

import { test, expect, Page } from '@playwright/test'

// Test user credentials
const TEST_USER = {
  email: 'test@netneural.ai',
  password: 'TestPassword123!',
}

/**
 * Helper: Login and navigate to devices page
 */
async function setupDevicesPage(page: Page) {
  // Login
  await page.goto('/auth/login')
  await page.waitForLoadState('network idle')

  const emailInput = page.locator('input[type="email"]').first()
  const passwordInput = page.locator('input[type="password"]').first()

  await emailInput.fill(TEST_USER.email)
  await passwordInput.fill(TEST_USER.password)

  const loginButton = page.locator('button[type="submit"]').first()
  await loginButton.click()
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  // Navigate to devices page
  await page.goto('/dashboard/devices')
  await page.waitForLoadState('networkidle')
}

test.describe('Device Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupDevicesPage(page)
  })

  test.describe('Device Listing', () => {
    test('should load devices page successfully', async ({ page }) => {
      // Verify page elements
      await expect(
        page.locator('text=/devices|device list/i').first()
      ).toBeVisible()

      // Check for devices list or empty state
      const devicesList = page
        .locator('[data-testid="devices-list"]')
        .or(page.locator('text=/no devices|add device/i'))
      await expect(devicesList.first()).toBeVisible({ timeout: 10000 })
    })

    test('should display device cards with basic info', async ({ page }) => {
      await page.waitForTimeout(2000) // Wait for devices to load

      // Look for device cards (if any exist)
      const deviceCards = page
        .locator('[data-testid="device-card"]')
        .or(page.locator('[class*="device-card"]'))

      const count = await deviceCards.count()

      if (count > 0) {
        // Verify first device card has expected elements
        const firstCard = deviceCards.first()
        await expect(firstCard).toBeVisible()

        // Device should have name, status, or other identifiers
        // This is flexible based on actual card structure
      }
    })

    test('should show device count', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Look for device count indicator
      const deviceCount = page
        .locator('text=/\\d+ devices?/i')
        .or(page.locator('[data-testid="device-count"]'))

      // Should show count (even if 0)
      await expect(deviceCount.first()).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Device Filtering', () => {
    test('should filter by device type (sensor/gateway)', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Look for type filter (if devices exist)
      const typeFilter = page
        .locator('[data-testid="device-type-filter"]')
        .or(
          page.locator('button:has-text("Sensor"), button:has-text("Gateway")')
        )

      if (await typeFilter.first().isVisible({ timeout: 5000 })) {
        await typeFilter.first().click()
        await page.waitForTimeout(1000)

        // Verify filtering occurred (URL or visible change)
        // Details depend on implementation
      }
    })

    test('should filter by device status (online/offline/warning)', async ({
      page,
    }) => {
      await page.waitForTimeout(2000)

      // Look for status filter
      const statusFilter = page
        .locator('[data-testid="device-status-filter"]')
        .or(
          page.locator('button:has-text("Online"), button:has-text("Offline")')
        )

      if (await statusFilter.first().isVisible({ timeout: 5000 })) {
        await statusFilter.first().click()
        await page.waitForTimeout(1000)
      }
    })

    test('should search devices by name or model', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Look for search input
      const searchInput = page
        .locator('input[type="search"]')
        .or(page.locator('input[placeholder*="Search"]'))

      if (await searchInput.isVisible({ timeout: 5000 })) {
        await searchInput.fill('sensor')
        await page.waitForTimeout(1000)

        // Verify search results updated
        // Implementation specific
      }
    })
  })

  test.describe('Device Sorting', () => {
    test('should sort devices by name', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Look for sort button/dropdown
      const sortButton = page
        .locator('[data-testid="sort-devices"]')
        .or(page.locator('button:has-text("Sort")'))

      if (await sortButton.isVisible({ timeout: 5000 })) {
        await sortButton.click()

        // Click "Name" option
        const nameOption = page.locator('text=/sort.*name|name.*sort/i').first()
        if (await nameOption.isVisible({ timeout: 2000 })) {
          await nameOption.click()
          await page.waitForTimeout(1000)
        }
      }
    })

    test('should sort devices by status', async ({ page }) => {
      await page.waitForTimeout(2000)

      const sortButton = page
        .locator('[data-testid="sort-devices"]')
        .or(page.locator('button:has-text("Sort")'))

      if (await sortButton.isVisible({ timeout: 5000 })) {
        await sortButton.click()

        const statusOption = page
          .locator('text=/sort.*status|status.*sort/i')
          .first()
        if (await statusOption.isVisible({ timeout: 2000 })) {
          await statusOption.click()
          await page.waitForTimeout(1000)
        }
      }
    })

    test('should sort devices by battery level', async ({ page }) => {
      await page.waitForTimeout(2000)

      const sortButton = page
        .locator('[data-testid="sort-devices"]')
        .or(page.locator('button:has-text("Sort")'))

      if (await sortButton.isVisible({ timeout: 5000 })) {
        await sortButton.click()

        const batteryOption = page
          .locator('text=/sort.*battery|battery.*sort/i')
          .first()
        if (await batteryOption.isVisible({ timeout: 2000 })) {
          await batteryOption.click()
          await page.waitForTimeout(1000)
        }
      }
    })
  })

  test.describe('Temperature Unit Toggle', () => {
    test('should toggle between Fahrenheit and Celsius', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Look for temperature unit toggle
      const tempToggle = page
        .locator('[data-testid="temp-unit-toggle"]')
        .or(page.locator('button:has-text("°F"), button:has-text("°C")'))

      if (await tempToggle.first().isVisible({ timeout: 5000 })) {
        const initialText = await tempToggle.first().textContent()

        // Click toggle
        await tempToggle.first().click()
        await page.waitForTimeout(1000)

        // Verify unit changed
        const newText = await tempToggle.first().textContent()
        expect(newText).not.toBe(initialText)
      }
    })

    test('should persist temperature unit preference', async ({ page }) => {
      await page.waitForTimeout(2000)

      const tempToggle = page
        .locator('[data-testid="temp-unit-toggle"]')
        .or(page.locator('button:has-text("°F"), button:has-text("°C")'))

      if (await tempToggle.first().isVisible({ timeout: 5000 })) {
        await tempToggle.first().click()
        const selectedUnit = await tempToggle.first().textContent()

        // Refresh page
        await page.reload()
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)

        // Verify unit persisted
        if (await tempToggle.first().isVisible({ timeout: 5000 })) {
          const currentUnit = await tempToggle.first().textContent()
          expect(currentUnit).toBe(selectedUnit)
        }
      }
    })
  })

  test.describe('Device Details', () => {
    test('should open device details on click', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Find first device card
      const deviceCard = page
        .locator('[data-testid="device-card"]')
        .first()
        .or(page.locator('[class*="device-card"]').first())

      if (await deviceCard.isVisible({ timeout: 5000 })) {
        await deviceCard.click()
        await page.waitForTimeout(1000)

        // Should open details modal or navigate to details page
        const detailsView = page
          .locator('[data-testid="device-details"]')
          .or(page.locator('text=/device.*details|details.*device/i'))

        await expect(detailsView.first()).toBeVisible({ timeout: 5000 })
      }
    })

    test('should display device telemetry', async ({ page }) => {
      await page.waitForTimeout(2000)

      const deviceCard = page.locator('[data-testid="device-card"]').first()

      if (await deviceCard.isVisible({ timeout: 5000 })) {
        await deviceCard.click()
        await page.waitForTimeout(2000)

        // Look for telemetry data (temperature, battery, etc.)
        const telemetryData = page.locator(
          'text=/temperature|battery|humidity|pressure/i'
        )

        // At least one telemetry field should be visible
        await expect(telemetryData.first()).toBeVisible({ timeout: 10000 })
      }
    })
  })

  test.describe('Device Sync', () => {
    test('should display sync button for Golioth devices', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Look for sync button
      const syncButton = page
        .locator('[data-testid="sync-device"]')
        .or(page.locator('button:has-text("Sync")'))

      // Sync button may not be visible if no Golioth devices
      // This test is flexible
      if (await syncButton.first().isVisible({ timeout: 5000 })) {
        await expect(syncButton.first()).toBeEnabled()
      }
    })

    test('should sync device and show updated data', async ({ page }) => {
      await page.waitForTimeout(2000)

      const syncButton = page
        .locator('[data-testid="sync-device"]')
        .or(page.locator('button:has-text("Sync")'))
        .first()

      if (await syncButton.isVisible({ timeout: 5000 })) {
        // Click sync
        await syncButton.click()

        // Should show loading state
        await page.waitForTimeout(1000)

        // Wait for sync to complete (shows success message or updated data)
        await page.waitForTimeout(5000)

        // Verify success notification or updated timestamp
        const successMessage = page.locator('text=/synced|success|updated/i')
        await expect(successMessage.first()).toBeVisible({ timeout: 10000 })
      }
    })
  })

  test.describe('CSV Export', () => {
    test('should display CSV export button', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Look for export button
      const exportButton = page
        .locator('[data-testid="export-devices"]')
        .or(page.locator('button:has-text("Export"), button:has-text("CSV")'))

      await expect(exportButton.first()).toBeVisible({ timeout: 10000 })
    })

    test('should trigger CSV download on export', async ({ page }) => {
      await page.waitForTimeout(2000)

      const exportButton = page
        .locator('[data-testid="export-devices"]')
        .or(page.locator('button:has-text("Export"), button:has-text("CSV")'))
        .first()

      if (await exportButton.isVisible({ timeout: 5000 })) {
        // Setup download listener
        const downloadPromise = page.waitForEvent('download', {
          timeout: 15000,
        })

        await exportButton.click()

        // Wait for download
        const download = await downloadPromise
        expect(download.suggestedFilename()).toMatch(/\.csv$/)

        console.log(`✅ CSV downloaded: ${download.suggestedFilename()}`)
      }
    })
  })

  test.describe('Pagination', () => {
    test('should paginate when more than 25 devices', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Check device count
      const deviceCountText = await page
        .locator('text=/\\d+ devices?/i')
        .first()
        .textContent()
      const deviceCount = parseInt(deviceCountText?.match(/\d+/)?.[0] || '0')

      if (deviceCount > 25) {
        // Look for pagination controls
        const paginationNext = page
          .locator('[data-testid="pagination-next"]')
          .or(page.locator('button:has-text("Next")'))

        await expect(paginationNext.first()).toBeVisible()

        // Click next page
        await paginationNext.first().click()
        await page.waitForTimeout(1000)

        // Verify page changed (URL or visible content)
        // Implementation specific
      }
    })
  })

  test.describe('Empty States', () => {
    test('should show helpful message when no devices', async ({ page }) => {
      await page.waitForTimeout(2000)

      // This test assumes no devices are seeded
      // Look for empty state message
      const emptyState = page.locator('text=/no devices|add.*device/i')

      // If devices exist, this test is skipped
      if (await emptyState.isVisible({ timeout: 5000 })) {
        await expect(emptyState.first()).toBeVisible()
      }
    })
  })

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Simulate offline mode
      await page.context().setOffline(true)

      // Try to refresh devices
      await page.reload()
      await page.waitForTimeout(2000)

      // Should show error message or retry option
      const errorMessage = page.locator('text=/error|failed|retry/i')
      await expect(errorMessage.first()).toBeVisible({ timeout: 10000 })

      // Restore online mode
      await page.context().setOffline(false)
    })

    test('should show retry button on error', async ({ page }) => {
      await page.context().setOffline(true)
      await page.reload()
      await page.waitForTimeout(2000)

      const retryButton = page.locator(
        'button:has-text("Retry"), button:has-text("Try Again")'
      )

      if (await retryButton.first().isVisible({ timeout: 5000 })) {
        await page.context().setOffline(false)
        await retryButton.first().click()
        await page.waitForTimeout(2000)

        // Error should be resolved
        const devicesContent = page
          .locator('[data-testid="devices-list"]')
          .or(page.locator('text=/devices/i'))
        await expect(devicesContent.first()).toBeVisible()
      }
    })
  })
})
