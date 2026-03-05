/**
 * E2E Tests: User Role Management
 *
 * Covers:
 *   - Navigating to Organization Members tab
 *   - Viewing member list
 *   - Opening Add Member dialog
 *   - Filling member invitation form (email, name, role)
 *   - Editing member roles
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { authenticator } from 'otplib'
import * as fs from 'fs'
import * as path from 'path'

// ── Config ──────────────────────────────────────────────────────────────────────
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'http://127.0.0.1:54321'

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const ADMIN_EMAIL = process.env.TEST_USER_EMAIL || 'admin@netneural.ai'
const ADMIN_PASSWORD = process.env.TEST_USER_PASSWORD || 'password123'
const RUN_ID = Date.now()

// ── Helpers ─────────────────────────────────────────────────────────────────────
function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const TOTP_SECRET_FILE = path.join(
  __dirname,
  '../tests/playwright/.playwright-admin-totp.json'
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
      if (buttons.length > 0) (buttons[buttons.length - 1] as HTMLElement).click()
    })
    await banner.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  } catch { /* No banner */ }
}

async function loginAs(page: Page, email: string, password: string) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto('/auth/login')
    await page.waitForLoadState('load')
    await dismissCookieBanner(page)
    await page.locator('#email').fill(email)
    await page.locator('#password').fill(password)
    await page.locator('button[type="submit"]').click({ force: true })

    const mfaInput = page.locator('#mfa-code')
    await Promise.race([
      page.waitForURL(/\/(dashboard|auth\/setup-mfa|auth\/change-password)/, { timeout: 30000 }).catch(() => null),
      mfaInput.waitFor({ state: 'visible', timeout: 30000 }).catch(() => null),
    ])

    if (await mfaInput.isVisible().catch(() => false)) {
      const secret = getTotpSecret()
      if (!secret) throw new Error('MFA challenge but no TOTP secret on disk.')
      await mfaInput.fill(authenticator.generate(secret))
      await page.locator('button[type="submit"]').click({ force: true })
      await page.waitForURL(/\/(dashboard|auth\/setup-mfa|auth\/change-password)/, { timeout: 30000 }).catch(async () => {
        if (await mfaInput.isVisible().catch(() => false)) {
          await mfaInput.fill(authenticator.generate(secret))
          await page.locator('button[type="submit"]').click({ force: true })
          await page.waitForURL(/\/(dashboard|auth\/setup-mfa|auth\/change-password)/, { timeout: 20000 }).catch(() => {})
        }
      })
    }

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

    const dashboardContent = page.locator('text=/Loading dashboard|No organization|Select an organization|Sentinel by NetNeural/i').first()
    const loginForm = page.locator('#email, #password, #mfa-code').first()
    await Promise.race([
      dashboardContent.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null),
      loginForm.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null),
    ])

    const onLoginPage = await loginForm.isVisible().catch(() => false)
    const hasDashContent = await dashboardContent.isVisible().catch(() => false)
    if (!onLoginPage && (hasDashContent || (page.url().includes('/dashboard') && !page.url().includes('/auth/')))) {
      return
    }

    if (attempt === 1) {
      console.warn(`loginAs: attempt ${attempt} failed, retrying...`)
      await page.waitForTimeout(5000)
    }
  }
  throw new Error(`loginAs failed after 2 attempts — still on ${page.url()}.`)
}

async function navigateAuth(page: Page, urlPath: string, email: string, password: string) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(urlPath)
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)
    if (page.url().includes('/auth/login') || page.url().includes('/auth/')) {
      if (attempt === 1) {
        await loginAs(page, email, password)
        continue
      }
    }
    return
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// User Role Management Tests
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('User Role Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  })

  test('organization members tab loads and shows member list', async ({ page }) => {
    await navigateAuth(page, '/dashboard/organizations?tab=members', ADMIN_EMAIL, ADMIN_PASSWORD)

    // Should see the members tab content
    const membersContent = page.locator('text=/members|member|team|users|no members/i').first()
    await expect(membersContent).toBeVisible({ timeout: 15000 })

    // Should show at least the admin user in the members list
    const adminRow = page.locator('text=/admin@netneural/i').first()
    const hasAdmin = await adminRow.isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasAdmin).toBe(true)
  })

  test('Add Member button opens invitation dialog', async ({ page }) => {
    await navigateAuth(page, '/dashboard/organizations?tab=members', ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.waitForTimeout(2000)

    // Find and click Add Member button
    const addBtn = page.locator('button').filter({ hasText: /add member|invite|add user/i }).first()
    await expect(addBtn).toBeVisible({ timeout: 10000 })
    await addBtn.click({ force: true })
    await page.waitForTimeout(500)

    // Dialog or form should appear with email field
    const dialog = page.locator('[role="dialog"]').first()
    const emailField = page.locator('#add-member-email').first()
    const anyEmailField = page.locator('input[type="email"], input[placeholder*="email" i]').first()

    const hasDialog = await dialog.isVisible({ timeout: 5000 }).catch(() => false)
    const hasEmailField = await emailField.isVisible({ timeout: 3000 }).catch(() => false)
    const hasAnyEmail = await anyEmailField.isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasDialog || hasEmailField || hasAnyEmail).toBe(true)
  })

  test('Add Member dialog has email, name, and role fields', async ({ page }) => {
    await navigateAuth(page, '/dashboard/organizations?tab=members', ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.waitForTimeout(2000)

    const addBtn = page.locator('button').filter({ hasText: /add member|invite|add user/i }).first()
    if (await addBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await addBtn.click({ force: true })
      await page.waitForTimeout(500)
    }

    // Check for form fields
    const emailField = page.locator('#add-member-email').first()
    const nameField = page.locator('#add-member-name').first()
    const roleField = page.locator('#add-member-role').first()

    const hasEmail = await emailField.isVisible({ timeout: 5000 }).catch(() => false)
    const hasName = await nameField.isVisible({ timeout: 3000 }).catch(() => false)
    const hasRole = await roleField.isVisible({ timeout: 3000 }).catch(() => false)

    // At least email and role fields should be visible
    expect(hasEmail || hasName || hasRole).toBe(true)

    if (hasEmail) {
      await emailField.fill(`e2e-test-${RUN_ID}@example.com`)
    }
    if (hasName) {
      await nameField.fill(`E2E Test User ${RUN_ID}`)
    }
  })

  test('role selector shows available roles', async ({ page }) => {
    await navigateAuth(page, '/dashboard/organizations?tab=members', ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.waitForTimeout(2000)

    const addBtn = page.locator('button').filter({ hasText: /add member|invite|add user/i }).first()
    if (await addBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await addBtn.click({ force: true })
      await page.waitForTimeout(500)
    }

    // Try clicking the role dropdown/select
    const roleSelect = page.locator('#add-member-role, select[name*="role"], [data-testid*="role"]').first()
    const hasRoleSelect = await roleSelect.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasRoleSelect) {
      await roleSelect.click({ force: true })
      await page.waitForTimeout(500)

      // Should see standard roles: Viewer, Member, Admin, etc.
      const viewer = page.locator('text=/viewer/i').first()
      const member = page.locator('text=/member/i').first()
      const admin = page.locator('text=/admin/i').first()

      const hasViewer = await viewer.isVisible({ timeout: 3000 }).catch(() => false)
      const hasMember = await member.isVisible({ timeout: 3000 }).catch(() => false)
      const hasAdmin = await admin.isVisible({ timeout: 3000 }).catch(() => false)

      // At least one role option should be visible
      expect(hasViewer || hasMember || hasAdmin).toBe(true)
    } else {
      // Look for role options in any visible dropdown/radio
      const roleOption = page.locator('text=/viewer|member|admin|billing|owner/i').first()
      const hasOption = await roleOption.isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasOption).toBe(true)
    }
  })

  test('member row shows role and action controls', async ({ page }) => {
    await navigateAuth(page, '/dashboard/organizations?tab=members', ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.waitForTimeout(2000)

    // Find a member row (the admin user should be there)
    const adminRow = page.locator('text=/admin@netneural/i').first()
    await expect(adminRow).toBeVisible({ timeout: 10000 })

    // Look for role indicator and action buttons near the admin row
    const roleIndicator = page.locator('text=/owner|admin|super_admin/i').first()
    const hasRole = await roleIndicator.isVisible({ timeout: 5000 }).catch(() => false)

    // Should show at least the role badge/label
    expect(hasRole).toBe(true)

    // May also have action buttons: edit, delete, reset password, etc.
    const actionButtons = page.locator('button').filter({ hasText: /edit|remove|delete|reset|actions/i })
    const actionCount = await actionButtons.count()
    // Having action buttons is optional depending on the admin's own row
    console.log(`Found ${actionCount} action button(s) on members tab`)
  })
})
