/**
 * Shared E2E Login Helper
 * Handles email/password login + MFA (TOTP) challenge.
 */
import { type Page } from '@playwright/test'
import { authenticator } from 'otplib'
import * as fs from 'fs'
import * as path from 'path'

export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'admin@netneural.ai',
  password: process.env.TEST_USER_PASSWORD || 'password123',
}

const TOTP_SECRET_FILE = path.join(
  __dirname,
  '../../tests/playwright/.playwright-admin-totp.json'
)

let _totpSecret: string | null = null
function getTotpSecret(): string | null {
  if (_totpSecret !== null) return _totpSecret
  try {
    const data = JSON.parse(fs.readFileSync(TOTP_SECRET_FILE, 'utf-8'))
    _totpSecret = data.secret ?? null
  } catch {
    _totpSecret = null
  }
  return _totpSecret
}

async function dismissCookieBanner(page: Page) {
  try {
    const banner = page.locator('[role="dialog"][aria-label*="ookie"]')
    await banner.waitFor({ state: 'visible', timeout: 3000 })
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      if (!dialog) return
      const buttons = dialog.querySelectorAll('button')
      if (buttons.length > 0)
        (buttons[buttons.length - 1] as HTMLElement).click()
    })
    await banner.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  } catch {
    /* No banner */
  }
}

/**
 * Login as admin user, handling MFA if enrolled.
 * After login, navigates to the dashboard (or specified path).
 */
export async function loginAs(
  page: Page,
  email = TEST_USER.email,
  password = TEST_USER.password
) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto('/auth/login')
    await page.waitForLoadState('load')
    await dismissCookieBanner(page)
    await page.locator('#email').fill(email)
    await page.locator('#password').fill(password)
    await page.locator('button[type="submit"]').click({ force: true })

    const mfaInput = page.locator('#mfa-code')
    await Promise.race([
      page
        .waitForURL(
          /\/(dashboard|auth\/setup-mfa|auth\/change-password)/,
          { timeout: 30000 }
        )
        .catch(() => null),
      mfaInput
        .waitFor({ state: 'visible', timeout: 30000 })
        .catch(() => null),
    ])

    if (await mfaInput.isVisible().catch(() => false)) {
      const secret = getTotpSecret()
      if (!secret) throw new Error('MFA challenge but no TOTP secret on disk.')
      await mfaInput.fill(authenticator.generate(secret))
      await page.locator('button[type="submit"]').click({ force: true })
      await page
        .waitForURL(
          /\/(dashboard|auth\/setup-mfa|auth\/change-password)/,
          { timeout: 30000 }
        )
        .catch(async () => {
          if (await mfaInput.isVisible().catch(() => false)) {
            await mfaInput.fill(authenticator.generate(secret))
            await page.locator('button[type="submit"]').click({ force: true })
            await page
              .waitForURL(
                /\/(dashboard|auth\/setup-mfa|auth\/change-password)/,
                { timeout: 20000 }
              )
              .catch(() => {})
          }
        })
    }

    // Handle redirects to setup-mfa or change-password
    if (page.url().includes('/auth/setup-mfa')) {
      await page.goto('/dashboard')
      await page.waitForLoadState('load')
      await page.waitForTimeout(2000)
    }
    if (page.url().includes('/auth/change-password')) {
      await page.goto('/dashboard')
      await page.waitForLoadState('load')
    }
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard')
      await page.waitForLoadState('load')
    }

    // Verify we're on the dashboard
    const dashboardContent = page
      .locator(
        'text=/Loading dashboard|No organization|Select an organization|Sentinel by NetNeural/i'
      )
      .first()
    const loginForm = page.locator('#email, #password, #mfa-code').first()
    await Promise.race([
      dashboardContent
        .waitFor({ state: 'visible', timeout: 15000 })
        .catch(() => null),
      loginForm
        .waitFor({ state: 'visible', timeout: 15000 })
        .catch(() => null),
    ])

    const onLoginPage = await loginForm.isVisible().catch(() => false)
    const hasDashContent = await dashboardContent.isVisible().catch(() => false)
    if (
      !onLoginPage &&
      (hasDashContent ||
        (page.url().includes('/dashboard') &&
          !page.url().includes('/auth/')))
    ) {
      return
    }

    if (attempt === 1) {
      console.warn(`loginAs: attempt ${attempt} failed, retrying...`)
      await page.waitForTimeout(5000)
    }
  }
  throw new Error(`loginAs failed after 2 attempts — still on ${page.url()}.`)
}

/**
 * Login and navigate to a specific page.
 */
export async function loginAndGoTo(page: Page, path: string) {
  await loginAs(page)
  if (path !== '/dashboard') {
    await page.goto(path)
    await page.waitForLoadState('load')
  }
}
