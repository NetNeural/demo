import { test, expect } from '@playwright/test'

test.describe('NetNeural App Health Check', () => {
  test('should load homepage', async ({ page }) => {
    const response = await page.goto('http://localhost:3000')
    console.log('Homepage status:', response?.status())

    // Take screenshot for debugging
    await page.screenshot({ path: 'homepage.png' })

    expect(response?.status()).toBeLessThan(500)
  })

  test('should handle auth/login page', async ({ page }) => {
    page.on('console', (msg) => console.log('Browser console:', msg.text()))
    page.on('response', (response) => {
      if (response.status() >= 400) {
        console.log(`❌ ${response.status()} ${response.url()}`)
      }
    })

    const response = await page.goto('http://localhost:3000/auth/login')
    console.log('Login page status:', response?.status())

    // Get page title and content
    const title = await page.title()
    console.log('Page title:', title)

    // Take screenshot
    await page.screenshot({ path: 'login-page.png' })

    // Get any error messages
    const bodyText = await page.textContent('body')
    if (bodyText?.includes('Error') || bodyText?.includes('error')) {
      console.log('Page contains error text')
    }

    expect(response?.status()).toBeLessThan(500)
  })

  test('should check dashboard redirect', async ({ page }) => {
    const response = await page.goto('http://localhost:3000/dashboard')
    console.log('Dashboard status:', response?.status())
    console.log('Final URL:', page.url())

    await page.screenshot({ path: 'dashboard.png' })
  })
})
