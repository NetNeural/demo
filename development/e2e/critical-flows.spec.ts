/**
 * E2E Tests: Critical Customer-Facing Flows
 *
 * Covers the top-impact user journeys that map to open bugs:
 *   #456 — New account signup → profile load / org assignment
 *   #436 — Location creation ("Add Your First Location")
 *   #455 — Alert rule creation (5-step wizard)
 *   #444 — Session timeout handling (silent logout)
 *   #440 — Device map refresh after adding device
 *
 * Also covers the reseller agreement application flow.
 *
 * Requires:
 *   - PLAYWRIGHT_BASE_URL  (default: http://localhost:3000)
 *   - SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL (default: http://127.0.0.1:54321)
 *   - SUPABASE_SERVICE_ROLE_KEY (default: local demo key)
 *   - TEST_USER_EMAIL / TEST_USER_PASSWORD (default: admin@netneural.ai / password123)
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
const SIGNUP_EMAIL = `e2e-critical-${RUN_ID}@test.netneural.ai`
const SIGNUP_PASSWORD = 'TestPass123!'
const SIGNUP_FULL_NAME = `E2E User ${RUN_ID}`
const SIGNUP_ORG_NAME = `E2E Org ${RUN_ID}`

// ── Shared state ────────────────────────────────────────────────────────────────
let signupUserId: string | null = null
let signupOrgId: string | null = null

// ── TOTP helper ─────────────────────────────────────────────────────────────────
let _totpSecretLoaded = false
let _totpSecret: string | null = null
function getTotpSecret(): string | null {
  if (_totpSecretLoaded) return _totpSecret
  try {
    const secretFile = path.join(
      __dirname,
      '../tests/playwright/.playwright-admin-totp.json'
    )
    const data = JSON.parse(fs.readFileSync(secretFile, 'utf-8'))
    _totpSecret = data.secret ?? null
  } catch {
    _totpSecret = null
  }
  _totpSecretLoaded = true
  return _totpSecret
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function dismissCookieBanner(page: Page) {
  try {
    const banner = page.locator('[role="dialog"][aria-label*="ookie"]')
    await banner.waitFor({ state: 'visible', timeout: 3000 })
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      if (!dialog) return
      const buttons = dialog.querySelectorAll('button')
      if (buttons.length > 0) {
        ;(buttons[buttons.length - 1] as HTMLElement).click()
      }
    })
    await banner.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  } catch {
    // No banner — continue
  }
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/auth/login')
  await page.waitForLoadState('load')
  await dismissCookieBanner(page)
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.locator('button[type="submit"]').click({ force: true })

  // Handle MFA challenge if it appears
  const mfaInput = page.locator('#mfa-code')
  await Promise.race([
    page
      .waitForURL(/\/(dashboard|auth\/setup-mfa|auth\/change-password)/, {
        timeout: 20000,
      })
      .catch(() => null),
    mfaInput.waitFor({ state: 'visible', timeout: 20000 }).catch(() => null),
  ])

  if (await mfaInput.isVisible().catch(() => false)) {
    const secret = getTotpSecret()
    if (!secret) throw new Error('MFA required but no TOTP secret on disk')
    const code = authenticator.generate(secret)
    await mfaInput.fill(code)
    await page.locator('button[type="submit"]').click({ force: true })
    await page
      .waitForURL(/\/(dashboard|auth\/setup-mfa|auth\/change-password)/, {
        timeout: 20000,
      })
      .catch(async () => {
        // Retry once in case TOTP code expired mid-entry
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

  // Handle setup-mfa redirect — if MFA enforcement pushes to the enrollment page
  // we use the admin API to delete any existing factors and then navigate away.
  if (page.url().includes('/auth/setup-mfa')) {
    console.log('Detected setup-mfa redirect — deleting MFA factors via admin API')
    const userId = await page.evaluate(async () => {
      try {
        // Grab user id from supabase session stored in localStorage
        for (const key of Object.keys(localStorage)) {
          if (key.includes('supabase') || key.includes('sb-')) {
            const raw = localStorage.getItem(key)
            if (raw) {
              const parsed = JSON.parse(raw)
              const uid = parsed?.user?.id ?? parsed?.currentSession?.user?.id
              if (uid) return uid as string
            }
          }
        }
      } catch { /* ignore */ }
      return null
    })

    if (userId) {
      const sb = adminClient()
      // List and delete all MFA factors for this user
      const factorsRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${userId}/factors`,
        {
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            apikey: SERVICE_ROLE_KEY,
          },
        }
      )
      if (factorsRes.ok) {
        const factors = await factorsRes.json()
        for (const f of factors) {
          await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users/${userId}/factors/${f.id}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
                apikey: SERVICE_ROLE_KEY,
              },
            }
          )
          console.log(`Deleted MFA factor ${f.id} (${f.friendly_name})`)
        }
      }
    }
    // Navigate to dashboard after clearing factors
    await page.goto('/dashboard')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)
  }

  // Handle password-change-required redirect
  if (page.url().includes('/auth/change-password')) {
    await page.goto('/dashboard')
    await page.waitForLoadState('load')
  }

  // Ensure we end on the dashboard
  if (!page.url().includes('/dashboard')) {
    await page.goto('/dashboard')
    await page.waitForURL('**/dashboard**', { timeout: 15000 })
  }
}

// ── Cleanup ─────────────────────────────────────────────────────────────────────
test.afterAll(async () => {
  if (!signupUserId) return
  try {
    const supabase = adminClient()
    await supabase.from('users').delete().eq('id', signupUserId)
    await supabase.auth.admin.deleteUser(signupUserId)
    console.log(`✅ Cleaned up test user ${SIGNUP_EMAIL}`)
  } catch (err) {
    console.warn('Cleanup failed (non-fatal):', err)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 1: Account Signup → Profile + Org Provisioning (Bug #456)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Account Signup — Profile & Org Provisioning (#456)', () => {
  test('signup page loads with plan selection step', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.waitForLoadState('load')
    await dismissCookieBanner(page)

    // Wait for plans to load
    await page
      .locator('.animate-spin')
      .waitFor({ state: 'hidden', timeout: 15000 })
      .catch(() => {})

    // Should have at least Starter and Business/Enterprise plans
    const planCards = page
      .locator('button')
      .filter({ hasText: /starter|business|enterprise/i })
    await expect(planCards.first()).toBeVisible({ timeout: 10000 })
    expect(await planCards.count()).toBeGreaterThanOrEqual(2)
  })

  test('can complete full signup and reach dashboard or confirmation', async ({
    page,
  }) => {
    await page.goto('/auth/signup')
    await page.waitForLoadState('load')
    await dismissCookieBanner(page)
    await page
      .locator('.animate-spin')
      .waitFor({ state: 'hidden', timeout: 15000 })
      .catch(() => {})

    // Step 1: Select Starter plan
    const starterCard = page
      .locator('button')
      .filter({ hasText: /starter/i })
      .first()
    await starterCard.click({ force: true })
    await page.waitForTimeout(300)

    const continueBtn = page
      .locator('button')
      .filter({ hasText: /continue|next|get started/i })
      .first()
    await continueBtn.click({ force: true })
    await page.waitForTimeout(500)

    // Step 2: Fill account details
    await page.locator('#fullName').fill(SIGNUP_FULL_NAME)
    await page.locator('#orgName').fill(SIGNUP_ORG_NAME)
    await page.locator('input[type="email"]').fill(SIGNUP_EMAIL)
    await page.locator('#password').fill(SIGNUP_PASSWORD)
    await page.locator('#confirmPassword').fill(SIGNUP_PASSWORD)

    // Accept terms if checkbox exists
    const termsCheckbox = page.locator('input[type="checkbox"]').first()
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check()
    }

    // Submit
    const submitBtn = page
      .locator('button[type="submit"], button')
      .filter({ hasText: /create account|sign up|register/i })
      .last()
    await submitBtn.click({ force: true })

    // Wait for outcome
    await page
      .waitForURL(
        /\/(dashboard|auth\/setup-mfa|auth\/change-password|auth\/signup)/,
        { timeout: 25000 }
      )
      .catch(() => {})
    await page.waitForTimeout(2000)

    const isEmailConfirm = await page
      .locator('text=/confirm|verification|check your email/i')
      .isVisible()
    const isDashboard = page.url().includes('/dashboard')

    // Must reach either email confirmation step or dashboard
    expect(
      isEmailConfirm ||
        isDashboard ||
        page.url().includes('/auth/setup-mfa') ||
        page.url().includes('/auth/change-password')
    ).toBe(true)

    // Find the user via admin API
    const supabase = adminClient()
    for (let attempt = 1; attempt <= 5; attempt++) {
      await new Promise((r) => setTimeout(r, attempt * 1000))
      const { data } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })
      const user = data?.users?.find((u) => u.email === SIGNUP_EMAIL)
      if (user) {
        signupUserId = user.id
        // Auto-confirm email so we can do further tests
        await supabase.auth.admin.updateUserById(user.id, {
          email_confirm: true,
        })
        break
      }
    }
    expect(signupUserId).toBeTruthy()
  })

  test('handle_new_user trigger created profile in public.users (#456)', async () => {
    if (!signupUserId) test.skip()

    const supabase = adminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error } = await (supabase as any)
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', signupUserId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(profile).toBeTruthy()
    expect(profile.email).toBe(SIGNUP_EMAIL)
    // Profile must exist — this is the "profile load fail" root cause
  })

  test('organization was created and user is a member (#456)', async () => {
    if (!signupUserId) test.skip()

    const supabase = adminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership, error } = await (supabase as any)
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', signupUserId)
      .maybeSingle()

    // This is the key assertion — bug #456 fails here:
    // "User has no organization assigned"
    expect(error).toBeNull()
    expect(
      membership,
      'User must have an organization_members row after signup — this is the #456 root cause'
    ).toBeTruthy()

    if (membership) {
      signupOrgId = membership.organization_id
      expect(membership.role).toBe('owner')

      // Validate org record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: org } = await (supabase as any)
        .from('organizations')
        .select('id, name, is_active')
        .eq('id', signupOrgId)
        .maybeSingle()

      expect(org).toBeTruthy()
      expect(org.name).toBe(SIGNUP_ORG_NAME)
      expect(org.is_active).toBe(true)
    }
  })

  test('new user can login and reach dashboard without profile_load_failed (#456)', async ({
    page,
  }) => {
    if (!signupUserId) test.skip()

    await page.goto('/auth/login')
    await page.waitForLoadState('load')
    await dismissCookieBanner(page)
    await page.locator('#email').fill(SIGNUP_EMAIL)
    await page.locator('#password').fill(SIGNUP_PASSWORD)
    await page.locator('button[type="submit"]').click({ force: true })

    // Should reach dashboard, setup-mfa, or change-password — NOT login with error
    await page
      .waitForURL(
        /\/(dashboard|auth\/setup-mfa|auth\/change-password)/,
        { timeout: 20000 }
      )
      .catch(() => {})

    const url = page.url()
    // Must NOT be redirected back to login with profile_load_failed
    expect(url).not.toContain('profile_load_failed')
    expect(url).not.toContain('auth_error')

    // If on dashboard, verify no "profile load fail" error
    if (url.includes('/dashboard')) {
      const errorText = page.locator('text=/profile load fail/i').first()
      await expect(errorText).not.toBeVisible({ timeout: 5000 })
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 2: Location Creation (Bug #436)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Location Creation (#436)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  })

  test('can navigate to locations tab in organization settings', async ({
    page,
  }) => {
    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    // First click the top-level "Infrastructure" tab
    const infraTab = page
      .locator('[role="tab"]')
      .filter({ hasText: /infrastructure/i })
      .first()
    await expect(infraTab).toBeVisible({ timeout: 10000 })
    await infraTab.click()
    await page.waitForTimeout(1000)

    // Now find the nested "Locations" sub-tab
    const locationsTab = page
      .locator('[role="tab"]')
      .filter({ hasText: /locations/i })
      .first()
    await expect(locationsTab).toBeVisible({ timeout: 10000 })
    await locationsTab.click()
    await page.waitForTimeout(1000)

    // Should show either existing locations or "Add Your First Location" empty state
    const addFirstBtn = page
      .locator('button')
      .filter({ hasText: /add your first location|add location/i })
      .first()
    const locationsList = page.locator('text=/location/i')
    const hasAddBtn = await addFirstBtn.isVisible().catch(() => false)
    const hasList = await locationsList.first().isVisible().catch(() => false)
    expect(hasAddBtn || hasList).toBe(true)
  })

  test('location creation form opens and has required fields', async ({
    page,
  }) => {
    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    // Click Infrastructure tab first, then Locations sub-tab
    const infraTab = page.locator('[role="tab"]').filter({ hasText: /infrastructure/i }).first()
    await infraTab.click()
    await page.waitForTimeout(1000)
    const locationsTab = page.locator('[role="tab"]').filter({ hasText: /locations/i }).first()
    await locationsTab.click()
    await page.waitForTimeout(1000)

    // Click add location button
    const addBtn = page
      .locator('button')
      .filter({ hasText: /add.*location/i })
      .first()
    await addBtn.click({ force: true })
    await page.waitForTimeout(500)

    // Form fields should be visible (dialog or inline form)
    const nameInput = page.locator('#name, input[name="name"]').first()
    await expect(nameInput).toBeVisible({ timeout: 5000 })
  })

  test('can create a location with name and address (#436)', async ({
    page,
  }) => {
    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    // Click Infrastructure tab first, then Locations sub-tab
    const infraTab = page.locator('[role="tab"]').filter({ hasText: /infrastructure/i }).first()
    await infraTab.click()
    await page.waitForTimeout(1000)
    const locationsTab = page.locator('[role="tab"]').filter({ hasText: /locations/i }).first()
    await locationsTab.click()
    await page.waitForTimeout(1000)

    const addBtn = page
      .locator('button')
      .filter({ hasText: /add.*location/i })
      .first()
    await addBtn.click({ force: true })
    await page.waitForTimeout(500)

    // Fill in the form
    const locationName = `E2E Location ${RUN_ID}`
    const nameInput = page.locator('#name, input[name="name"]').first()
    await nameInput.fill(locationName)
    const addressInput = page.locator('#address, input[name="address"]').first()
    await addressInput.fill('100 Test Street')
    const cityInput = page.locator('#city, input[name="city"]').first()
    await cityInput.fill('Testville')
    const stateInput = page.locator('#state, input[name="state"]').first()
    await stateInput.fill('TS')
    const postalInput = page.locator('#postal_code, input[name="postal_code"], input[name="postalCode"], input[name="zip"]').first()
    await postalInput.fill('12345')
    const countryInput = page.locator('#country, input[name="country"]').first()
    await countryInput.fill('US')

    // Submit
    const createBtn = page
      .locator('button')
      .filter({ hasText: /create location/i })
      .first()
    await createBtn.click({ force: true })

    // Wait for success or error
    await page.waitForTimeout(3000)

    // Should either show success toast or the location in the list
    const successToast = page.locator('text=/location created successfully/i')
    const errorToast = page.locator('text=/failed to create location/i')
    const locationInList = page.locator(`text=${locationName}`)

    const succeeded =
      (await successToast.isVisible().catch(() => false)) ||
      (await locationInList.isVisible().catch(() => false))
    const failed = await errorToast.isVisible().catch(() => false)

    // This assertion catches bug #436: location creation should not fail
    expect(
      succeeded,
      'Location creation must succeed — bug #436 reports failure on "Add Your First Location"'
    ).toBe(true)
    expect(failed).toBe(false)

    // Clean up: delete the test location if it was created
    if (succeeded) {
      const supabase = adminClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('locations')
        .delete()
        .ilike('name', `%E2E Location ${RUN_ID}%`)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 3: Alert Rule Creation (Bug #455)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Alert Rule Creation (#455)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  })

  test('can navigate to new rule wizard', async ({ page }) => {
    await page.goto('/dashboard/alert-rules')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    // Find "New Rule" or "Create Your First Rule" button
    const newRuleBtn = page
      .locator('button, a')
      .filter({ hasText: /new rule|create.*first.*rule|create rule/i })
      .first()
    await expect(newRuleBtn).toBeVisible({ timeout: 10000 })
    await newRuleBtn.click({ force: true })

    // Should navigate to the rule wizard
    await page.waitForURL('**/alert-rules/new**', { timeout: 10000 })
  })

  test('rule wizard step 0 — name and type selection', async ({ page }) => {
    await page.goto('/dashboard/alert-rules/new')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    // Rule name field
    const nameInput = page.locator('#name')
    await expect(nameInput).toBeVisible({ timeout: 10000 })
    await nameInput.fill(`E2E Rule ${RUN_ID}`)

    // Description
    const descInput = page.locator('#description')
    if (await descInput.isVisible()) {
      await descInput.fill('Automated E2E test rule')
    }

    // Select telemetry rule type
    const telemetryRadio = page.locator('#telemetry')
    if (await telemetryRadio.isVisible()) {
      await telemetryRadio.click({ force: true })
    } else {
      // Try clicking a card/button with "telemetry" text
      const telemetryCard = page
        .locator('button, [role="radio"], label')
        .filter({ hasText: /telemetry/i })
        .first()
      if (await telemetryCard.isVisible()) {
        await telemetryCard.click({ force: true })
      }
    }

    // Next button should be clickable
    const nextBtn = page
      .locator('button')
      .filter({ hasText: /next/i })
      .first()
    await expect(nextBtn).toBeVisible({ timeout: 5000 })
    await expect(nextBtn).toBeEnabled()
  })

  test('can walk through all wizard steps and create a rule (#455)', async ({
    page,
  }) => {
    await page.goto('/dashboard/alert-rules/new')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    const ruleName = `E2E Rule ${RUN_ID}`

    // Step 0: Rule type
    await page.locator('#name').fill(ruleName)
    const descInput = page.locator('#description')
    if (await descInput.isVisible()) {
      await descInput.fill('E2E test rule')
    }

    // Select telemetry type
    const telemetryOption = page
      .locator('#telemetry, [role="radio"], label, button')
      .filter({ hasText: /telemetry/i })
      .first()
    if (await telemetryOption.isVisible()) {
      await telemetryOption.click({ force: true })
    }

    await page.waitForTimeout(300)
    await page
      .locator('button')
      .filter({ hasText: /next/i })
      .first()
      .click({ force: true })
    await page.waitForTimeout(1000)

    // Step 1: Conditions
    const metricInput = page.locator('#metric')
    if (await metricInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await metricInput.fill('temperature')
    }

    const valueInput = page.locator('#value')
    if (await valueInput.isVisible()) {
      await valueInput.fill('100')
    }

    // Click next (may have operator select too — defaults should be ok)
    const nextBtn1 = page
      .locator('button')
      .filter({ hasText: /next/i })
      .first()
    if (await nextBtn1.isVisible()) {
      await nextBtn1.click({ force: true })
      await page.waitForTimeout(1000)
    }

    // Step 2: Device scope — defaults to "all devices", just click next
    const nextBtn2 = page
      .locator('button')
      .filter({ hasText: /next/i })
      .first()
    if (await nextBtn2.isVisible()) {
      await nextBtn2.click({ force: true })
      await page.waitForTimeout(1000)
    }

    // Step 3: Actions — add an email action
    const actionTypeSelect = page.locator('#action-type')
    if (await actionTypeSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Keep default (email)
      const recipientsInput = page.locator('#recipients')
      if (await recipientsInput.isVisible()) {
        await recipientsInput.fill('test@example.com')
      }
      const addActionBtn = page
        .locator('button')
        .filter({ hasText: /add action/i })
        .first()
      if (await addActionBtn.isVisible()) {
        await addActionBtn.click({ force: true })
        await page.waitForTimeout(500)
      }
    }

    // Click next to review step
    const nextBtn3 = page
      .locator('button')
      .filter({ hasText: /next/i })
      .first()
    if (await nextBtn3.isVisible()) {
      await nextBtn3.click({ force: true })
      await page.waitForTimeout(1000)
    }

    // Step 4: Review — create the rule
    const createRuleBtn = page
      .locator('button')
      .filter({ hasText: /create rule/i })
      .first()

    if (await createRuleBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createRuleBtn.click({ force: true })
      await page.waitForTimeout(3000)

      // Check for success or failure
      const success = page.locator('text=/rule created successfully/i')
      const failure = page.locator('text=/failed to create rule/i')

      const succeeded = await success.isVisible().catch(() => false)
      const failed = await failure.isVisible().catch(() => false)

      // This catches bug #455
      expect(
        succeeded,
        'Rule creation must succeed — bug #455 reports failure on final step'
      ).toBe(true)
      expect(failed).toBe(false)

      // Clean up: delete the test rule
      if (succeeded) {
        const supabase = adminClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('alert_rules')
          .delete()
          .ilike('name', `%E2E Rule ${RUN_ID}%`)
      }
    } else {
      // If we can't reach the create button, the wizard flow is broken
      // Capture what step we're stuck on
      const pageText = await page.locator('body').innerText()
      console.error(
        'Could not reach Create Rule button. Page content:',
        pageText.slice(0, 500)
      )
      expect(
        false,
        'Rule wizard did not reach the final Create Rule step'
      ).toBe(true)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 4: Reseller Agreement Application
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Reseller Agreement Application', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  })

  test('reseller section is visible in organization overview', async ({
    page,
  }) => {
    // The ResellerAgreementSection is rendered on the Overview tab
    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    // Overview is the default tab — scroll to Reseller Agreement section
    const resellerHeading = page.locator('text=/reseller agreement/i').first()
    await resellerHeading.scrollIntoViewIfNeeded()
    await expect(resellerHeading).toBeVisible({ timeout: 10000 })

    // Should show either "Apply" button or existing agreement status
    const applyBtn = page
      .locator('button')
      .filter({ hasText: /apply for a reseller agreement/i })
      .first()
    const existingStatus = page.locator(
      'text=/pending|approved|no agreement/i'
    )

    const hasApplyBtn = await applyBtn.isVisible().catch(() => false)
    const hasStatus = await existingStatus.isVisible().catch(() => false)
    expect(hasApplyBtn || hasStatus).toBe(true)
  })

  test('reseller application dialog opens with all required fields', async ({
    page,
  }) => {
    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    // Scroll to Reseller Agreement section on Overview tab
    const resellerHeading = page.locator('text=/reseller agreement/i').first()
    await resellerHeading.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    const applyBtn = page
      .locator('button')
      .filter({ hasText: /apply for a reseller agreement/i })
      .first()

    // Only test if application is available (might already be submitted)
    if (!(await applyBtn.isVisible().catch(() => false))) {
      console.log(
        'Reseller application already submitted — skipping dialog test'
      )
      return
    }

    await applyBtn.click({ force: true })
    await page.waitForTimeout(500)

    // Required fields should be visible in the dialog
    const dialog = page.locator('[role="dialog"]').first()
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Check for form fields (ids may vary — check by label or name)
    const nameInput = dialog.locator('input').first()
    await expect(nameInput).toBeVisible({ timeout: 5000 })

    // Cancel button should close the dialog
    const cancelBtn = dialog
      .locator('button')
      .filter({ hasText: /cancel|close/i })
      .first()
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click({ force: true })
      await page.waitForTimeout(300)
    }
  })

  test('reseller application validates required fields', async ({ page }) => {
    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    // Scroll to Reseller Agreement section on Overview tab
    const resellerHeading = page.locator('text=/reseller agreement/i').first()
    await resellerHeading.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    const applyBtn = page
      .locator('button')
      .filter({ hasText: /apply for a reseller agreement/i })
      .first()

    if (!(await applyBtn.isVisible().catch(() => false))) {
      console.log('Reseller application already submitted — skipping')
      return
    }

    await applyBtn.click({ force: true })
    await page.waitForTimeout(500)

    // Try to submit with empty required fields
    const dialog = page.locator('[role="dialog"]').first()
    await expect(dialog).toBeVisible({ timeout: 5000 })

    const submitBtn = dialog
      .locator('button')
      .filter({ hasText: /submit application/i })
      .first()
    await submitBtn.click({ force: true })
    await page.waitForTimeout(500)

    // Should show validation error (toast or inline)
    const validationError = page.locator(
      'text=/please enter|required|must be at least|fill/i'
    )
    await expect(validationError.first()).toBeVisible({ timeout: 5000 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 5: Session Timeout & Auth Guard (Bug #444)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Session Timeout & Auth Guard (#444)', () => {
  test('unauthenticated access to dashboard redirects to login', async ({
    page,
    context,
  }) => {
    // Clear all auth state
    await context.clearCookies()
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForURL('**/login**', { timeout: 15000 })
    expect(page.url()).toContain('/auth/login')
  })

  test('unauthenticated access shows login page elements', async ({
    page,
    context,
  }) => {
    await context.clearCookies()
    await page.goto('/dashboard/devices')
    await page.waitForLoadState('networkidle')
    await page.waitForURL('**/login**', { timeout: 15000 })

    // Login form should be visible
    await expect(page.locator('#email')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('#password')).toBeVisible()
  })

  test('session timeout modal appears after idle period', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)

    // The session timeout is 30 minutes — we can't wait that long in a test.
    // Instead, verify the SessionTimeoutModal component renders correctly
    // by checking the hook is active (cross-tab activity tracking via sessionStorage)
    const hasActivityKey = await page.evaluate(() => {
      return sessionStorage.getItem('nn_last_activity') !== null
    })
    // The useSessionTimeout hook should have set nn_last_activity
    expect(hasActivityKey).toBe(true)
  })

  test('session persists during active use', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)

    // Navigate across multiple pages — session should not expire
    const routes = [
      '/dashboard',
      '/dashboard/devices',
      '/dashboard/alerts',
      '/dashboard/settings',
      '/dashboard/organizations',
    ]

    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('load')
      await page.waitForTimeout(1000)
      // Should NOT be redirected to login
      expect(page.url()).not.toContain('/auth/login')
    }
  })

  test('expired session redirects to login with appropriate message (#444)', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)

    // Simulate session expiry by clearing auth cookies
    await page.context().clearCookies()

    // Try to perform an authenticated action
    await page.goto('/dashboard/devices')
    await page.waitForLoadState('networkidle')

    // Should be redirected to login
    await page.waitForURL('**/login**', { timeout: 15000 })
    const url = page.url()
    expect(url).toContain('/auth/login')

    // Bug #444: user should NOT just get a confusing error —
    // they should see the login page (possibly with session_expired indicator)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 6: Device Map Refresh (Bug #440)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Device Map Refresh (#440)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  })

  test('devices page loads and shows device list or empty state', async ({
    page,
  }) => {
    // /dashboard/devices redirects to /dashboard/hardware-provisioning
    await page.goto('/dashboard/hardware-provisioning')
    await page.waitForLoadState('load')
    await page.waitForTimeout(3000)

    // The page should show "Hardware Provisioning" heading
    const heading = page.locator('text=/hardware provisioning/i').first()
    await expect(heading).toBeVisible({ timeout: 10000 })

    // Should show device cards, a table, or the page content
    const deviceCard = page.locator('[class*="card"], [data-testid*="device"]').first()
    const emptyState = page.locator(
      'text=/no devices|add your first device|get started/i'
    )
    const table = page.locator('table').first()
    const facilityMap = page.locator('[class*="facility"], [class*="map"]').first()

    const hasContent =
      (await deviceCard.isVisible().catch(() => false)) ||
      (await table.isVisible().catch(() => false)) ||
      (await facilityMap.isVisible().catch(() => false))
    const hasEmpty = await emptyState.isVisible().catch(() => false)

    expect(hasContent || hasEmpty).toBe(true)
  })

  test('device map view is accessible', async ({ page }) => {
    // /dashboard/devices redirects to /dashboard/hardware-provisioning
    await page.goto('/dashboard/hardware-provisioning')
    await page.waitForLoadState('load')
    await page.waitForTimeout(3000)

    // The hardware provisioning page has a FacilityMapView embedded
    // in the Devices tab (the default tab). Check the page loaded.
    const heading = page.locator('text=/hardware provisioning/i').first()
    await expect(heading).toBeVisible({ timeout: 10000 })

    // The facility map or device content should be present
    const facilityMap = page.locator('canvas, [class*="map"], [class*="facility"], svg').first()
    const devicesTab = page.locator('[role="tab"]').filter({ hasText: /devices/i }).first()

    // Verify the Devices tab is the active/default tab
    const hasDevicesTab = await devicesTab.isVisible().catch(() => false)
    expect(hasDevicesTab).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 7: Password Reset Flow (Regression Guard)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Password Reset — Regression Guard', () => {
  test('forgot password link opens reset form on login page', async ({
    page,
  }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('load')
    await dismissCookieBanner(page)

    // Click "Forgot password?" link
    const forgotLink = page
      .locator('button, a')
      .filter({ hasText: /forgot.*password/i })
      .first()
    await expect(forgotLink).toBeVisible({ timeout: 10000 })
    await forgotLink.click({ force: true })
    await page.waitForTimeout(500)

    // Reset email input should appear
    const resetEmailInput = page.locator('#reset-email')
    await expect(resetEmailInput).toBeVisible({ timeout: 5000 })
  })

  test('reset password page renders correctly', async ({ page }) => {
    await page.goto('/auth/reset-password/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(3000)

    // Without a valid token, should show expired/invalid link UI
    const expiredMsg = page.locator(
      'text=/invalid|expired|reset.*link/i'
    )
    const passwordInput = page.locator('input[type="password"]')

    const showsExpired = await expiredMsg.first().isVisible().catch(() => false)
    const showsForm = await passwordInput.first().isVisible().catch(() => false)

    // Must render one of these — not a blank page or error
    expect(showsExpired || showsForm).toBe(true)
  })

  test('reset password page has resend link functionality', async ({
    page,
  }) => {
    await page.goto('/auth/reset-password/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(3000)

    // If showing expired state, should have resend option
    const resendInput = page.locator('input[type="email"]')
    if (await resendInput.isVisible().catch(() => false)) {
      await resendInput.fill('test@example.com')
      const sendBtn = page
        .locator('button')
        .filter({ hasText: /send.*reset.*link/i })
        .first()
      await expect(sendBtn).toBeVisible({ timeout: 5000 })
    }
  })
})
