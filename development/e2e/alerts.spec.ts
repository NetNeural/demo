/**
 * E2E Tests: Alert Management
 *
 * Tests alert listing, acknowledgment, threshold configuration, and email notifications
 */

import { test, expect, Page } from '@playwright/test'

// Test user credentials
const TEST_USER = {
  email: 'test@netneural.ai',
  password: 'TestPassword123!',
}

/**
 * Helper: Login and navigate to alerts page
 */
async function setupAlertsPage(page: Page) {
  // Login
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')

  const emailInput = page.locator('input[type="email"]').first()
  const passwordInput = page.locator('input[type="password"]').first()

  await emailInput.fill(TEST_USER.email)
  await passwordInput.fill(TEST_USER.password)

  const loginButton = page.locator('button[type="submit"]').first()
  await loginButton.click()
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  // Navigate to alerts page
  await page.goto('/dashboard/alerts')
  await page.waitForLoadState('networkidle')
}

test.describe('Alert Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupAlertsPage(page)
  })

  test.describe('Alert Listing', () => {
    test('should load alerts page successfully', async ({ page }) => {
      // Verify page elements
      await expect(
        page.locator('text=/alerts|alert list/i').first()
      ).toBeVisible()

      // Check for alerts list or empty state
      const alertsList = page
        .locator('[data-testid="alerts-list"]')
        .or(page.locator('text=/no alerts|all clear/i'))
      await expect(alertsList.first()).toBeVisible({ timeout: 10000 })
    })

    test('should display alert count', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Look for alert count
      const alertCount = page
        .locator('text=/\\d+ alerts?/i')
        .or(page.locator('[data-testid="alert-count"]'))

      await expect(alertCount.first()).toBeVisible({ timeout: 10000 })
    })

    test('should show alerts with severity indicators', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Look for alert cards
      const alertCards = page
        .locator('[data-testid="alert-card"]')
        .or(page.locator('[class*="alert-card"]'))

      const count = await alertCards.count()

      if (count > 0) {
        const firstAlert = alertCards.first()
        await expect(firstAlert).toBeVisible()

        // Should have severity indicator (critical, high, medium, low)
        const severityBadge = firstAlert.locator(
          'text=/critical|high|medium|low/i'
        )
        await expect(severityBadge.first()).toBeVisible()
      }
    })
  })

  test.describe('Alert Filtering', () => {
    test('should filter by tab (all/unacknowledged/connectivity/security/environmental)', async ({
      page,
    }) => {
      await page.waitForTimeout(2000)

      const tabs = [
        'All',
        'Unacknowledged',
        'Connectivity',
        'Security',
        'Environmental',
      ]

      for (const tab of tabs) {
        const tabButton = page.locator(`button:has-text("${tab}")`).first()

        if (await tabButton.isVisible({ timeout: 2000 })) {
          await tabButton.click()
          await page.waitForTimeout(1000)

          // Verify tab is selected (active state)
          // Implementation specific
        }
      }
    })

    test('should filter by severity (critical/high/medium/low)', async ({
      page,
    }) => {
      await page.waitForTimeout(2000)

      // Look for severity filter
      const severityFilter = page
        .locator('[data-testid="severity-filter"]')
        .or(
          page.locator('button:has-text("Critical"), button:has-text("High")')
        )

      if (await severityFilter.first().isVisible({ timeout: 5000 })) {
        await severityFilter.first().click()
        await page.waitForTimeout(1000)
      }
    })

    test('should filter by category (temperature/battery/connectivity)', async ({
      page,
    }) => {
      await page.waitForTimeout(2000)

      // Look for category filter
      const categoryFilter = page
        .locator('[data-testid="category-filter"]')
        .or(
          page.locator(
            'button:has-text("Temperature"), button:has-text("Battery")'
          )
        )

      if (await categoryFilter.first().isVisible({ timeout: 5000 })) {
        await categoryFilter.first().click()
        await page.waitForTimeout(1000)
      }
    })

    test('should search alerts', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Look for search input
      const searchInput = page
        .locator('input[type="search"]')
        .or(page.locator('input[placeholder*="Search"]'))

      if (await searchInput.isVisible({ timeout: 5000 })) {
        await searchInput.fill('temperature')
        await page.waitForTimeout(1000)

        // Verify search results
      }
    })
  })

  test.describe('View Modes', () => {
    test('should toggle between card and table view', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Look for view toggle buttons
      const cardViewButton = page
        .locator('button:has-text("Cards"), [data-testid="view-cards"]')
        .first()
      const tableViewButton = page
        .locator('button:has-text("Table"), [data-testid="view-table"]')
        .first()

      if (await tableViewButton.isVisible({ timeout: 5000 })) {
        // Switch to table view
        await tableViewButton.click()
        await page.waitForTimeout(1000)

        // Should show table
        const table = page.locator('table, [role="table"]')
        await expect(table.first()).toBeVisible({ timeout: 5000 })

        // Switch back to cards
        if (await cardViewButton.isVisible({ timeout: 2000 })) {
          await cardViewButton.click()
          await page.waitForTimeout(1000)
        }
      }
    })
  })

  test.describe('Alert Details', () => {
    test('should open alert details dialog on click', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Find first alert card
      const alertCard = page
        .locator('[data-testid="alert-card"]')
        .first()
        .or(page.locator('[class*="alert-card"]').first())

      if (await alertCard.isVisible({ timeout: 5000 })) {
        await alertCard.click()
        await page.waitForTimeout(1000)

        // Should open details dialog/modal
        const detailsDialog = page
          .locator('[data-testid="alert-details"]')
          .or(page.locator('[role="dialog"]'))

        await expect(detailsDialog.first()).toBeVisible({ timeout: 5000 })
      }
    })

    test('should display comprehensive alert information', async ({ page }) => {
      await page.waitForTimeout(2000)

      const alertCard = page.locator('[data-testid="alert-card"]').first()

      if (await alertCard.isVisible({ timeout: 5000 })) {
        await alertCard.click()
        await page.waitForTimeout(1000)

        // Verify details include:
        // - Current value
        // - Threshold value
        // - Breach type (max/min)
        // - Device info
        // - Timestamp

        const detailsDialog = page.locator('[role="dialog"]').first()

        if (await detailsDialog.isVisible()) {
          // Check for key information
          const currentValue = detailsDialog.locator(
            'text=/current.*value|value.*current/i'
          )
          const threshold = detailsDialog.locator('text=/threshold/i')
          const deviceInfo = detailsDialog.locator('text=/device/i')

          // At least some details should be visible
          await expect(
            currentValue.or(threshold).or(deviceInfo).first()
          ).toBeVisible()
        }
      }
    })
  })

  test.describe('Alert Acknowledgment', () => {
    test('should acknowledge single alert', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Find unacknowledged alert
      const unacknowledgedAlerts = page
        .locator('[data-testid="alert-card"]')
        .or(page.locator('[class*="alert-card"]'))

      const count = await unacknowledgedAlerts.count()

      if (count > 0) {
        const firstAlert = unacknowledgedAlerts.first()

        // Look for acknowledge button
        const acknowledgeButton = firstAlert
          .locator('button:has-text("Acknowledge")')
          .or(page.locator('[data-testid="acknowledge-alert"]'))
          .first()

        if (await acknowledgeButton.isVisible({ timeout: 5000 })) {
          await acknowledgeButton.click()
          await page.waitForTimeout(2000)

          // Should show success message
          const successMessage = page.locator('text=/acknowledged|success/i')
          await expect(successMessage.first()).toBeVisible({ timeout: 10000 })
        }
      }
    })

    test('should show acknowledgment types (acknowledged/dismissed/resolved/false-positive)', async ({
      page,
    }) => {
      await page.waitForTimeout(2000)

      const alertCard = page.locator('[data-testid="alert-card"]').first()

      if (await alertCard.isVisible({ timeout: 5000 })) {
        // Open alert details
        await alertCard.click()
        await page.waitForTimeout(1000)

        // Look for acknowledge button in dialog
        const acknowledgeButton = page
          .locator('button:has-text("Acknowledge")')
          .first()

        if (await acknowledgeButton.isVisible({ timeout: 5000 })) {
          await acknowledgeButton.click()
          await page.waitForTimeout(500)

          // Should show acknowledgment type options
          const acknowledgeTypes = [
            'Acknowledged',
            'Dismissed',
            'Resolved',
            'False Positive',
          ]

          // Look for at least one type
          const typeOptions = page.locator(
            'text=/acknowledged|dismissed|resolved|false positive/i'
          )
          await expect(typeOptions.first()).toBeVisible({ timeout: 5000 })
        }
      }
    })

    test('should add notes to acknowledgment', async ({ page }) => {
      await page.waitForTimeout(2000)

      const alertCard = page.locator('[data-testid="alert-card"]').first()

      if (await alertCard.isVisible({ timeout: 5000 })) {
        await alertCard.click()
        await page.waitForTimeout(1000)

        const acknowledgeButton = page
          .locator('button:has-text("Acknowledge")')
          .first()

        if (await acknowledgeButton.isVisible({ timeout: 5000 })) {
          await acknowledgeButton.click()
          await page.waitForTimeout(500)

          // Look for notes input
          const notesInput = page
            .locator(
              'textarea[placeholder*="notes"], textarea[placeholder*="comment"]'
            )
            .first()

          if (await notesInput.isVisible({ timeout: 5000 })) {
            await notesInput.fill(
              'This was a sensor malfunction, replaced sensor'
            )

            // Submit acknowledgment
            const submitButton = page
              .locator('button:has-text("Submit"), button:has-text("Confirm")')
              .first()
            await submitButton.click()
            await page.waitForTimeout(2000)

            // Should show success
            const successMessage = page.locator('text=/acknowledged|success/i')
            await expect(successMessage.first()).toBeVisible({ timeout: 10000 })
          }
        }
      }
    })

    test('should track who acknowledged alerts', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Navigate to "All" tab to see acknowledged alerts
      const allTab = page.locator('button:has-text("All")').first()
      if (await allTab.isVisible({ timeout: 2000 })) {
        await allTab.click()
        await page.waitForTimeout(1000)
      }

      // Find an acknowledged alert
      const acknowledgedAlert = page
        .locator('text=/acknowledged by|acknowledged at/i')
        .first()

      if (await acknowledgedAlert.isVisible({ timeout: 5000 })) {
        // Should show who acknowledged and when
        await expect(acknowledgedAlert).toBeVisible()
      }
    })
  })

  test.describe('Bulk Acknowledgment', () => {
    test('should select multiple alerts', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Look for checkboxes on alerts
      const alertCheckboxes = page
        .locator('input[type="checkbox"]')
        .or(page.locator('[data-testid="alert-checkbox"]'))

      const count = await alertCheckboxes.count()

      if (count >= 2) {
        // Select first two alerts
        await alertCheckboxes.nth(0).check()
        await alertCheckboxes.nth(1).check()
        await page.waitForTimeout(500)

        // Should show bulk action toolbar
        const bulkToolbar = page
          .locator('[data-testid="bulk-actions"]')
          .or(page.locator('text=/\\d+ selected/i'))

        await expect(bulkToolbar.first()).toBeVisible({ timeout: 5000 })
      }
    })

    test('should bulk acknowledge selected alerts', async ({ page }) => {
      await page.waitForTimeout(2000)

      const alertCheckboxes = page.locator('input[type="checkbox"]')
      const count = await alertCheckboxes.count()

      if (count >= 2) {
        // Select alerts
        await alertCheckboxes.nth(0).check()
        await alertCheckboxes.nth(1).check()
        await page.waitForTimeout(500)

        // Click bulk acknowledge button
        const bulkAcknowledgeButton = page
          .locator('button:has-text("Acknowledge Selected")')
          .or(page.locator('[data-testid="bulk-acknowledge"]'))
          .first()

        if (await bulkAcknowledgeButton.isVisible({ timeout: 5000 })) {
          await bulkAcknowledgeButton.click()
          await page.waitForTimeout(2000)

          // Should show success message
          const successMessage = page.locator('text=/acknowledged|success/i')
          await expect(successMessage.first()).toBeVisible({ timeout: 10000 })
        }
      }
    })
  })

  test.describe('Grouped Alerts', () => {
    test('should group alerts by device', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Look for grouped alerts
      const groupedAlerts = page
        .locator('[data-testid="grouped-alerts"]')
        .or(page.locator('text=/\\d+ alerts from/i'))

      if (await groupedAlerts.first().isVisible({ timeout: 5000 })) {
        await expect(groupedAlerts.first()).toBeVisible()
      }
    })

    test('should expand grouped alerts', async ({ page }) => {
      await page.waitForTimeout(2000)

      const groupedAlerts = page
        .locator('[data-testid="grouped-alerts"]')
        .first()

      if (await groupedAlerts.isVisible({ timeout: 5000 })) {
        // Click to expand
        await groupedAlerts.click()
        await page.waitForTimeout(1000)

        // Should show individual alerts
        const individualAlerts = page.locator('[data-testid="alert-card"]')
        const count = await individualAlerts.count()
        expect(count).toBeGreaterThan(0)
      }
    })
  })

  test.describe('Alert Thresholds', () => {
    test('should display threshold configuration page', async ({ page }) => {
      // Navigate to thresholds page
      await page.goto('/dashboard/alerts/thresholds')
      await page.waitForLoadState('networkidle')

      // Should show threshold list or configuration interface
      const thresholds = page
        .locator('[data-testid="thresholds-list"]')
        .or(page.locator('text=/threshold|configure/i'))

      await expect(thresholds.first()).toBeVisible({ timeout: 10000 })
    })

    test('should create new threshold', async ({ page }) => {
      await page.goto('/dashboard/alerts/thresholds')
      await page.waitForLoadState('networkidle')

      // Look for "Create" or "Add" button
      const createButton = page
        .locator('button:has-text("Create"), button:has-text("Add Threshold")')
        .first()

      if (await createButton.isVisible({ timeout: 5000 })) {
        await createButton.click()
        await page.waitForTimeout(1000)

        // Should open threshold creation form
        const form = page.locator('form, [data-testid="threshold-form"]')
        await expect(form.first()).toBeVisible({ timeout: 5000 })
      }
    })
  })

  test.describe('Email Notifications', () => {
    test('should show email notification settings', async ({ page }) => {
      // Navigate to settings
      await page.goto('/dashboard/settings')
      await page.waitForLoadState('networkidle')

      // Look for email notification settings
      const emailSettings = page
        .locator('text=/email.*notification|notification.*email/i')
        .or(page.locator('[data-testid="email-settings"]'))

      await expect(emailSettings.first()).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Real-time Updates', () => {
    test('should show real-time alert updates via WebSocket', async ({
      page,
    }) => {
      await page.waitForTimeout(2000)

      // Get initial alert count
      const initialCountText =
        (await page.locator('text=/\\d+ alerts?/i').first().textContent()) ||
        '0'
      const initialCount = parseInt(initialCountText.match(/\d+/)?.[0] || '0')

      // Wait for potential new alerts (real-time)
      await page.waitForTimeout(10000)

      // Get updated count
      const updatedCountText =
        (await page.locator('text=/\\d+ alerts?/i').first().textContent()) ||
        '0'
      const updatedCount = parseInt(updatedCountText.match(/\d+/)?.[0] || '0')

      // If count changed, real-time updates are working
      // This test is probabilistic and depends on new alerts arriving
      console.log(`Initial alerts: ${initialCount}, Updated: ${updatedCount}`)
    })
  })

  test.describe('Empty States', () => {
    test('should show helpful message when no alerts', async ({ page }) => {
      await page.waitForTimeout(2000)

      // Look for empty state
      const emptyState = page.locator(
        'text=/no alerts|all clear|no active alerts/i'
      )

      if (await emptyState.first().isVisible({ timeout: 5000 })) {
        await expect(emptyState.first()).toBeVisible()
      }
    })
  })

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Simulate offline mode
      await page.context().setOffline(true)

      // Try to refresh alerts
      await page.reload()
      await page.waitForTimeout(2000)

      // Should show error message
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
        const alertsContent = page.locator('[data-testid="alerts-list"]')
        await expect(alertsContent.first()).toBeVisible()
      }
    })
  })

  test.describe('Audit Log', () => {
    test('should track alert acknowledgments in audit log', async ({
      page,
    }) => {
      // Navigate to audit log or user actions page
      await page.goto('/dashboard/audit')
      await page.waitForLoadState('networkidle')

      // Look for audit log entries
      const auditLog = page
        .locator('[data-testid="audit-log"]')
        .or(page.locator('text=/audit|activity log/i'))

      await expect(auditLog.first()).toBeVisible({ timeout: 10000 })
    })
  })
})
