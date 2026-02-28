/**
 * App Health Check
 * Updated 2026-02-27 - uses baseURL from playwright config.
 */
import { test, expect } from '@playwright/test'

test.describe('NetNeural App Health Check', () => {
  test('should load homepage', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBeLessThan(500)
  })

  test('should load login page', async ({ page }) => {
    const response = await page.goto('/auth/login')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('#email')).toBeVisible({ timeout: 10000 })
  })

  test('should redirect unauthenticated dashboard to login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    await expect(page).toHaveURL(/login/)
  })
})
